import { Injectable } from '@nestjs/common';
// node.js example
import * as path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as fs from 'fs';
import { UserService } from './user.service';
import { MongoDataSource } from 'src/repository/mongo';
import { ModelRepo } from 'src/repository/mongo/entity/ModelRepo';

//const Docker = require('dockerode');
import * as Docker from 'dockerode'
import { Model, BuildingStatus, ModelConfig, Parameter } from 'src/repository/mongo/entity/Model';
import { MinIOConnection } from 'src/repository/minio';
import { Stream, Writable } from 'stream';
import { deleteFolderRecursive } from 'src/utils';
import { Train } from 'src/repository/mongo/entity/Train';
const docker = new Docker({socketPath: '/var/run/docker.sock'});

class StringWritable extends Writable {
  data: string;
  constructor() {
    super();
    this.data = ''; // 用于存储写入的数据
  }

  _write(chunk, encoding, callback) {
    // 将写入的数据块转换为字符串，并追加到内部数据
    this.data += chunk.toString();
    callback();
  }
}

@Injectable()
export class GitService {
  constructor(
    private readonly userService: UserService,
    private readonly minIOConnection: MinIOConnection,
    private readonly dataSource: MongoDataSource
  ){}

  async cloneRepo(repoId: number){
    const modelRepo = await this.dataSource.getRepository(ModelRepo).findOneBy({id: repoId})
    const username = modelRepo.username
    const password = modelRepo.password
    const workSpace = 'workSpace/' + modelRepo.id
    const url = modelRepo.url
    const dir = path.join(process.cwd(), workSpace)
    //删除之前的库，目前是同步写法，需要改为异步提升性能
    deleteFolderRecursive(dir)
    return git
    .clone({ fs, http, dir, url: url.toString(), 
      onAuth: _ => {
        return {
          username,
          password
        }
      }
    })
  }

  async addRepo(reponame: string, url: string, username: string, password: string){
    const modelRepo = new ModelRepo()
    modelRepo.url = url
    modelRepo.reponame = reponame
    modelRepo.username = username
    modelRepo.password = password
    const saved = await this.dataSource.manager.save(modelRepo)
    const workSpace = 'workSpace/' + saved.id
    const dir = path.join(process.cwd(), workSpace)
    git
      .clone({ fs, http, dir, url: url.toString(), 
        onAuth: _ => {
          return {
            username,
            password
          }
        }
      })
    modelRepo.workSpace = workSpace
    this.dataSource.manager.save(modelRepo)
  }

  async getRepos() {
    return this.dataSource.getRepository(ModelRepo).find()
  }

  async getRepoById(id: number) {
    return this.dataSource.getRepository(ModelRepo).findOneBy({id})
  }

  async getRepoWithModelsById(id: number) {
    return this.dataSource.getRepository(ModelRepo).findOne({
      relations: {
        models: true
      },
      where: {
        id
      }
    })
  }

  async isCloned(repoId: number){
    const repo = await this.getRepoById(repoId)
    return repo.workSpace !== null
  }

  async getWorkSpace(repoId: number) {
    const repo = await this.getRepoById(repoId)
    const workSpace = repo.workSpace
    if(workSpace === null) throw new Error()
    return path.join(process.cwd(), workSpace)
  }

  getTrainWorkSpace(trainId: number) {
    return path.join(process.cwd(), 'trainWorkSpace', String(trainId))
  }

  async listBranchesByRepoId(id: number) {
    const workSpace = await this.getWorkSpace(id)
    const remoteBranches = await git.listBranches({ fs, dir: workSpace, remote: 'origin' })
    return remoteBranches.slice(1)
  }

  async buildVersion(repoId: number, branch: string){
    const workSpace = await this.getWorkSpace(repoId)
    console.log('workSpace :>> ', workSpace);
    const stream = await docker.buildImage({
      context: workSpace,
      src: ['Dockerfile', './']
    })
    let imageId = null
    const res: any[] =  await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res), 
        obj => {
          console.log('building :>> ', obj.stream)
        });
    });
    imageId = res.find(item => item.aux && item.aux.ID).aux.ID
    
    return imageId
  }

  async createVersion(repoId: number, branch: string, description: string){
    //在数据库中记录已创建
    let model = new Model()
    model.description = description
    model.status = BuildingStatus.BUILDING
    model.modelRepo = await this.getRepoById(repoId)
    model = await this.dataSource.manager.save(model)
    //拉取新代码并切换分支
    await this.cloneRepo(repoId)
    //将配置文件存储在postgrey中，并根据配置文件将一些必要的文件存储在OSS中
    const workSpace = await this.getWorkSpace(repoId)
    //存储训练参数中的默认文件
    let config:string =  await new Promise((resolve, reject) => {
      fs.readFile(path.join(workSpace, 'mlop.config.json'), 'utf-8',(err, res) => {
        if(err) {
          reject(err)
        }
        resolve(res)
      })
    })
    const modelConfig = JSON.parse(config) as ModelConfig
    model.config = modelConfig
    const processParameterFile = async (parameter) => {
      if(parameter.type === 'file' && parameter.default){
        const data = await new Promise<Buffer>((resolve, reject) => {
          fs.readFile(path.join(workSpace, parameter.default), (err, data) => {
            if(err) {
              reject(err)
            }else{
              resolve(data)
            }
          })
        })
        parameter.default = {
          filename: parameter.default,
          etag: await this.minIOConnection.saveFile(data, parameter.default)
        }
      }
    }
    for(let parameter of model.config?.executors?.train?.parameters){
      await processParameterFile(parameter)
    }
    for(let parameter of model.config?.executors?.predict?.parameters){
      await processParameterFile(parameter)
    }
    this.dataSource.manager.save(model)
    //异步构建
    this.buildVersion(repoId, branch)
      .then(imageId => {
        if(imageId){ //拿到了imageId说明构建成功，否则失败
          model.imageId = imageId
          model.status = BuildingStatus.SUCCESS
        }else{
          model.status = BuildingStatus.FAILED
        }
      })
      .catch( _ => {
        model.status = BuildingStatus.FAILED
      })
      .finally(() => {
        this.dataSource.manager.save(model)
      })
  }

  async listVersion(repoId: number) {
    const repo = await this.getRepoWithModelsById(repoId)
    return repo.models
  }

  async getVersion(modelId: number) {
    const model = await this.dataSource.getRepository(Model).findOneBy({id: modelId})
    return model
  }


  //需要想办法在运行结束后清除容器
  async trainModel(modelId: number, params: any){
    const model = await this.dataSource.getRepository(Model).findOne(
      {
        relations: {
          modelRepo: true
        },
        where: {
          id: modelId
        }
      }
    )
    //数据库中记录训练已经开始>>>>>>>>>
    const initTrain = new Train()
    initTrain.model = model
    initTrain.parameters = params
    const train = await this.dataSource.getRepository(Train).save(initTrain)

    const imageId = model.imageId.split(':')[1]
    const workSpace = await this.getWorkSpace(model.modelRepo.id)
    //解析params
    //考虑CMD和ENTRYPOINT的选择
    const args = ['python', 'train.py']
    console.log('params :>> ', params);
    for(let key in params){
      if(typeof params[key] === 'object'){ // 文件
        const file = params[key]
        const stream = await this.minIOConnection.getFile(file.filename, file.versionId)
        const dest = path.join(workSpace,'data',file.filename)
        await new Promise(reslove => {
          fs.access(path.dirname(dest), fs.constants.F_OK, (err) => {
            if(err) {
              fs.mkdir(path.dirname(dest), (err) => {
                if(err){
                  console.error('无法创建文件夹', err)
                }
                reslove('')
              })
            }
            reslove('')
          })
        })
        const writableStream = fs.createWriteStream(dest)
        stream.pipe(writableStream)
        await new Promise(resolve => {
          stream.on('end', () => resolve(''))
        })
        args.push(`--${key}`)
        args.push(file.filename)
      }else{
        args.push(`--${key}`)
        args.push(String(params[key]))
      }
    }

    //创建训练工作区
    const trainWorkSpace = this.getTrainWorkSpace(train.id)
    docker.run(imageId, args, process.stdout, {
      Volumes: {
        '/workspace/data' : {},
        '/workspace/weights' : {}
      },
      HostConfig: {
        Binds: [
          `${[path.join(workSpace, 'data')]}:/workspace/data`,
          `${[path.join(trainWorkSpace, 'weights')]}:/workspace/weights`
        ]
      }
    })
  }

  async predict(trainId: number, params: any) {
    const train = await this.dataSource.getRepository(Train).findOne({
      relations: {
        model: true
      },
      where: {
        id: trainId
      }
    })

    const imageId = train.model.imageId.split(':')[1]

    console.log('params :>> ', params);
    const workSpace = this.getTrainWorkSpace(trainId)
    const args = ['python', 'predict.py']
    for(let key in params){
      if(typeof params[key] === 'object'){ // 文件
        const file = params[key]
        const stream = await this.minIOConnection.getFile(file.filename, file.versionId)
        const dest = path.join(workSpace,'data',file.filename)
        await new Promise(reslove => {
          fs.access(path.dirname(dest), fs.constants.F_OK, (err) => {
            if(err) {
              fs.mkdir(path.dirname(dest), (err) => {
                if(err){
                  console.error('无法创建文件夹', err)
                }
                reslove('')
              })
            }
            reslove('')
          })
        })
        const writableStream = fs.createWriteStream(dest)
        stream.pipe(writableStream)
        await new Promise(resolve => {
          stream.on('end', () => resolve(''))
        })
        args.push(`--${key}`)
        args.push(file.filename)
      }else{
        args.push(`--${key}`)
        args.push(String(params[key]))
      }
    }

    return new Promise((resolve, reject) => {
      const stringWritable = new StringWritable()
      docker.run(imageId, args, stringWritable, {
        Volumes: {
          '/workspace/data' : {},
          '/workspace/weights' : {}
        },
        HostConfig: {
          Binds: [
            `${[path.join(workSpace, 'data')]}:/workspace/data`,
            `${[path.join(workSpace, 'weights')]}:/workspace/weights`
          ]
        }
        },
      ).then(data => {
        let output = data[0]
        let container = data[1]
        console.log(output)
        console.log('string :>> ', stringWritable.data);
        resolve(stringWritable.data)
      })
    })
  }

  async listTrain(modelId: number) {
    const model = await this.dataSource.getRepository(Model).findOne({
      relations: {
        train: true
      },
      where: {
        id: modelId
      }
    })
    return model.train
  }
}
