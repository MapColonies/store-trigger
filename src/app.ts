import { Application } from 'express';
import { DependencyContainer } from 'tsyringe';
import { RegisterOptions, registerExternalValues } from './containerConfig';
import { ServerBuilder } from './serverBuilder';

function getApp(registerOptions?: RegisterOptions): { app: Application; container: DependencyContainer } {
  const container = registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();
  return { app, container };
}

export { getApp };
