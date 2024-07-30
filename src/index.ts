/* eslint-disable import/first */
// this import must be called before the first import of tsyring
import 'reflect-metadata';
import { getApp } from './app';

function main(): void {
  const app = getApp();

  app.run();
}

void main();

console.log('FINISH!!!!!!!!!');
