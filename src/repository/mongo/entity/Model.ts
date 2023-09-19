import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { ModelRepo } from "./ModelRepo";
import { Train } from "./Train";


export enum BuildingStatus {
    BUILDING,
    FAILED,
    SUCCESS
}

export interface Parameter{
    type: 'file' | 'bool' | 'string' | 'integer'
    enum?: string[]
    title: string
    label: string
    default: any
}

export interface ModelConfig {
    executors: {
        train: {
            command: string[],
            parameters: Parameter[]
        }
        predict: {
            command: string[],
            parameters: Parameter[]
        }
    }
}

@Entity()
export class Model {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    description: string

    @Column({
        nullable: true
    })
    imageId: string

    @ManyToOne(() => ModelRepo, (modelRepo) => modelRepo.models)
    modelRepo: ModelRepo

    @CreateDateColumn({
        nullable: true
    })
    createdAt: Date

    @UpdateDateColumn({
        nullable: true
    })
    updatedAt:Date

    @Column({
        type: 'json',
        nullable: true
    })
    config: ModelConfig

    @Column({
        type: 'enum',
        enum: BuildingStatus,
        default: BuildingStatus.BUILDING
    })
    status: BuildingStatus

    @OneToMany(() => Train, (train) => train.model)
    train: Train[]
}