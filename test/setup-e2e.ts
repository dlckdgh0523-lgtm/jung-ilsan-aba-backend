// Loads the dedicated test environment BEFORE AppModule is imported.
// override:true guarantees .env.test wins over any ambient vars; ConfigModule's
// later .env load won't clobber these (dotenv doesn't override existing keys).
import { config } from 'dotenv';

config({ path: '.env.test', override: true });
