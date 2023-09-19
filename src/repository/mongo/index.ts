import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { User } from "./entity/User";
import { ModelRepo } from "./entity/ModelRepo";
import { Model } from "./entity/Model";
import { Train } from "./entity/Train";
import { Predict } from "./entity/Predict";


@Injectable()
export class MongoDataSource extends DataSource {
    constructor() {
        super({
            type: "postgres",
            host: "localhost",
            port: 5432,
            username: "postgres",
            password: "admin",
            database: "postgres",
            synchronize: true,
            logging: true,
            entities: [User, ModelRepo, Model, Train, Predict],
            subscribers: [],
            migrations: [],
        })
        this.initialize()
            .then(() => {
                console.log('postgres conneceted')
            })
            .catch((err) => {
                console.log('postgres error')
                console.log(err)
            })
    }
}