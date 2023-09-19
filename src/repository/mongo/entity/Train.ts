import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Model } from "./Model";
import { Predict } from "./Predict";

export enum TrainingStatus {
    TRAINING,
    FAILED,
    SUCCESS
}

@Entity()
export class Train {
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

    @ManyToOne(() => Model, (model) => model.train)
    model: Model

    @OneToMany(() => Predict, (predict) => predict.train) 
    predict: Predict[]

    @Column({
        type: 'enum',
        enum: TrainingStatus,
        default: TrainingStatus.TRAINING
    })
    status: TrainingStatus

}