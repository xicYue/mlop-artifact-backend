import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GitService } from './services/git.service';
import { ManagerController } from './controllers/manager';
import { UserService } from './services/user.service';
import { MinIOConnection } from './repository/minio';
import { MongoDataSource } from './repository/mongo';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { AuthGuard } from './auth/auth.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AppController, ManagerController],
  providers: [
    AppService, 
    GitService, 
    UserService, 
    MinIOConnection, 
    MongoDataSource,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ]
})
export class AppModule {}
