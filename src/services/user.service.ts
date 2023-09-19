import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as crytpo from 'crypto'
import { MongoDataSource } from "src/repository/mongo";
import { User } from "src/repository/mongo/entity/User";
import { generateRandomString } from "src/utils";

@Injectable()
export class UserService {
    constructor(
        private readonly dataSource: MongoDataSource,
        private readonly jwtService: JwtService
    ){}
    
    async signUp(username: string, password: string) {
        const salt = generateRandomString(10)
        const hmac =  crytpo.createHmac('sha1', salt)
        const crytpedPassword = hmac.update(password).digest('base64')
        const newUser = new User()
        newUser.username = username
        newUser.password = crytpedPassword
        newUser.salt = salt
        await this.dataSource.manager.save(newUser)
    }

    async logIn(username: string, password: string) {
        const userRepo =  this.dataSource.getRepository(User)
        const foundUser = await userRepo.findOneBy({ username })
        if(!foundUser) return {
            code: 400,
            success: false,
            showType: 0,
            errorMessage: '该用户不存在'
        } 
        const hmac = crytpo.createHmac('sha1', foundUser.salt)
        const crytpedPassword = hmac.update(password).digest('base64')
        if (crytpedPassword !== foundUser.password) {
            return {
                success: false,
                errorMessage: '密码错误'
            }
        }
        return {
            code: 200,
            data: {
                access_token: 'Bearer ' + this.jwtService.sign({
                    id: foundUser.id,
                    username: foundUser.username
                })
            }
        }
    }
}