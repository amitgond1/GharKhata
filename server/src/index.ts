import { app } from './app.ts';
import { connect } from './models.ts';
import { config } from './config.ts';
import mongoose from 'mongoose';
try {
  await connect(config.mongo);
} catch {
  console.error('Database connection failed. Check MONGODB_URI and replica-set availability.');
  process.exit(1);
}
const server = app.listen(config.port, config.host, () =>
  console.log(`GharKhata API ready at http://${config.host}:${config.port}`),
);
const shutdown = () =>
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
