import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { Model } from "./Model"

@Entity()
export class ModelRepo {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    reponame: string

    @Column()
    url: string

    @Column()
    username: string

    @Column()
    password: string

    @Column({nullable: true})
    workSpace: string
    
    @OneToMany(() => Model, (model) => model.modelRepo)
    models: Model[]
}