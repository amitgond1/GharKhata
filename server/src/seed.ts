import { connect } from './models.ts';
import { config } from './config.ts';
import { makeDemo } from './demo.ts';
import mongoose from 'mongoose';
await connect(config.mongo);
const { project } = await makeDemo();
console.log(
  `Created isolated fictional demo project ${project._id}. Use Try demo in the browser to create a fresh, sign-in-ready copy.`,
);
await mongoose.disconnect();
