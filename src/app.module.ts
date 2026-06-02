import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SiteModule } from './site/site.module';
import { AboutModule } from './about/about.module';
import { DirectorModule } from './director/director.module';
import { CenterInfoModule } from './center-info/center-info.module';
import { HeroModule } from './hero/hero.module';
import { ProgramsModule } from './programs/programs.module';
import { TherapistsModule } from './therapists/therapists.module';
import { NoticesModule } from './notices/notices.module';
import { GalleryModule } from './gallery/gallery.module';
import { PopupsModule } from './popups/popups.module';
import { ConsultationsModule } from './consultations/consultations.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StatsModule } from './stats/stats.module';
import { PrivacyModule } from './privacy/privacy.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    // Generous global anti-abuse limit; per-route limits (e.g. consultations 5/min) override.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    AuthModule,
    SiteModule,
    AboutModule,
    DirectorModule,
    CenterInfoModule,
    HeroModule,
    ProgramsModule,
    TherapistsModule,
    NoticesModule,
    GalleryModule,
    PopupsModule,
    ConsultationsModule,
    RealtimeModule,
    StatsModule,
    PrivacyModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
