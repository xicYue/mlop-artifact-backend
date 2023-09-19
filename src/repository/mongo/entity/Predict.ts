import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from "typeorm"
import { Model } from "./Model"
import { Train, TrainingStatus } from "./Train"

export enum PredictingStatus {
    PREDICTING,
    FAILED,
    SUCCESS
}

@Entity()
export class Predict {
    @PrimaryGeneratedColumn()
    id: number

    @Column({
        type: 'json',
        nullable: true
    })
    parameters: any

    @CreateDateColumn({
        nullable: true
    })
    createdAt: Date

    @UpdateDateColumn({
        nullable: true
    })
    updatedAt:Date

    @ManyToOne(() => Train, (train) => train.predict)
    train: Train

    @Column({
        type: 'enum',
        enum: PredictingStatus,
        default: PredictingStatus.PREDICTING
    })
    status: PredictingStatus

}