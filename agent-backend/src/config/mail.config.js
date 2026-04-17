import { Resend } from 'resend';
import Mailgen from 'mailgen';
import config from './index.js';

// Only initialize Resend if API key is provided (for CI/testing environments)
const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

const mailgen = new Mailgen({
  theme: 'default',
  product: {
    name: 'Persona.ai',
    link: config.websiteUrl,
  },
});

export { resend, mailgen };
