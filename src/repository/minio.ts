import { Injectable } from "@nestjs/common";
import { Stream } from "stream";
var Minio = require('minio')


@Injectable()
export class MinIOConnection {
    ModelTrainBuketName = 'model-train'
    minioClient = new Minio.Client({
        endPoint: 'localhost',
        port: 9000,
        useSSL: false,
        accessKey: 'oNAXnVpmcPOq2ldtKREl',
        secretKey: 'PA00jxzNbfx44tp2KWNUV4usn4fJnSgHHYqDLYWx'
    })
    constructor(){
        this.minioClient.bucketExists(this.ModelTrainBuketName, (err, exists) => {
            if(err) throw err
            if(!exists){
                this.minioClient.makeBucket(this.ModelTrainBuketName, (err) => {
                    if(err) throw err
                })
            }
        })
    }
    saveFile(file: Buffer, name: string) {
        return new Promise((resolve, reject) => {
            this.minioClient.putObject(this.ModelTrainBuketName, name, file, (err, objInfo) => {
                if(err){
                    reject(err)
                }else{
                    resolve(objInfo)
                }
            })
        })
    }

    getFile(filename: string, versionId: string) {
        return new Promise<Stream>((resolve, reject) => {
            this.minioClient.getObject(this.ModelTrainBuketName, filename, {versionId}, (err, objInfo) => {
                if(err){
                    reject(err)
                }else{
                    resolve(objInfo as Stream)
                }
            })
        })
    }
}
