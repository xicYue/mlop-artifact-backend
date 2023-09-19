import { Body, Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { MinIOConnection } from 'src/repository/minio';
import { GitService } from 'src/services/git.service';
import { Public } from 'src/auth/public.auth';
import { UserService } from 'src/services/user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, response } from 'express';
import * as mime from 'mime';
import { Stream } from 'stream';


@Controller()
export class ManagerController {
  constructor(
        private readonly gitService: GitService,
        private readonly minIOConnection: MinIOConnection,
        private readonly userService: UserService
    ){}

  @Public()
  @Get('/signup')
  testMongo(){
    this.userService.signUp('admin', 'admin')
  }

  @Public()
  @Post('/login')
  async login(@Body('username') username, @Body('password') password, @Res() response: Response){
    const res = await this.userService.logIn(username, password)
    console.log('res :>> ', res);
    response.cookie('auth', res.data.access_token,{
      // 可选的配置选项
      httpOnly: true, // 该 Cookie 只能通过 HTTP(S) 协议访问，不允许通过 JavaScript 访问
      maxAge: 360000000, // 过期时间（单位：毫秒），此处设置为 100 小时
      secure: false, // 仅在 HTTPS 连接中传输 Cookie
    })
    response.json(res)
  }

  @Post('modelRepo/create')
  createModelRepo(@Body() params){
    this.gitService.addRepo(params.reponame ,params.url, params.username, params.password)
  }

  @Post('modelRepo/list')
  async listModelRepo(){
    const data = await this.gitService.getRepos()
    if(data) {
      return {
        code: 200,
        data
      }
    }
  }

  @Post('modelRepo/item/:id')
  async getModelRepoById(@Param('id') id : number) {
    const repo = await this.gitService.getRepoById(id)
    if(repo) {
      return {
        code: 200,
        data: repo
      }
    }
  }

  @Post('modelRepo/item/:id/listBranches')
  async listBranches(@Param('id') repoId: number) {
    const branches =  await this.gitService.listBranchesByRepoId(repoId)
    if(branches) {
      return {
        code: 200,
        data: branches
      }
    }
  }

  @Post('modelRepo/item/:id/createVersion')
  async createVersion(@Param('id') repoId: number, @Body('branch') branch, @Body('description') description) {
    this.gitService.createVersion(repoId, branch, description)
  }

  @Post('modelRepo/item/:id/listVersion')
  async listVersion(@Param('id') repoId: number) {
    const models = await this.gitService.listVersion(repoId)
    const parsed = models.map(model => {
      return {
        ...model,
        imageId : model.imageId?.substring(0, 17),
        content: [
          {
            label: '状态',
            value: model.status
          },
          {
            label: '创建时间',
            value: model.createdAt
          },
          {
            label: '更新时间',
            value: model.updatedAt
          }
        ]
      }
    })
    return {
      code: 200,
      data: parsed
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file:Express.Multer.File){
    file.filename = Buffer.from(file.originalname, "latin1").toString("utf8")
    console.log('file :>> ', file);
    const res:any = await this.minIOConnection.saveFile(file.buffer, file.filename)
    return {
      code: 200,
      data: {
        etag: res.etag
      }
    }
  }

  //仅开发时使用，生产环境下使用nginx代理转发到minio
  @Get('download/*/*')
  async downloadFile(@Param() params: any, @Res() res: Response){
    //const [filename, versionId] = params
    console.log('params :>> ', params);
    const file: Stream = await this.minIOConnection.getFile(params[0], params[1])
    res.setHeader('Content-Disposition', `attachment; filename=${params[0]}`)
    res.setHeader('Content-Type', 'application/octet-stream')
    file.pipe(res)
  }

  @Post('/trainModel/:modelId')
  async trainModel(@Param('modelId') modelId: number, @Body('parameters') parameters) {
    this.gitService.trainModel(modelId, parameters)
  }

  @Post('/predict/:trainId')
  async predict(@Param('trainId') trainId: number, @Body('parameters') parameters) {
    const res = await this.gitService.predict(trainId, parameters)
    return {
      code: 200,
      data: res
    }
  }

  @Post('/train/:modelId/list')
  async listTrain(@Param('modelId') modelId: number){
    const trains = await this.gitService.listTrain(modelId)
    return {
      code: 200,
      data: trains
    }
  }

  @Post('/model/:modelId')
  async getVersion(@Param('modelId') modelId: number){
    const model = await this.gitService.getVersion(modelId)
    return {
      code: 200,
      data: model
    }
  }
}