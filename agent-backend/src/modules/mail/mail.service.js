import { resend, mailgen } from '../../config/mail.config.js';
import config from '../../config/index.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

export const sendVerificationEmail = async (to, otp) => {
  if (!resend) {
    logger.warn('Resend not configured, skipping verification email', { to });
    return;
  }

  const email = {
    body: {
      name: to,
      intro: 'Welcome to Persona.ai! Verify your email address.',
      action: {
        instructions: `Your verification code is:`,
        button: {
          color: '#22BC66',
          text: otp,
          link: '#',
        },
      },
      outro:
        'This code expires in 10 minutes. If you did not create an account, please ignore this email.',
    },
  };

  const html = mailgen.generate(email);
  let text = mailgen.generatePlaintext(email);

  // Some mail generators insert a '#' placeholder for action links in plaintext.
  // Replace the first occurrence of '#' with the OTP so the plain-text email contains the code.
  if (typeof text === 'string' && otp && text.includes('#')) {
    text = text.replace('#', otp);
  }

  try {
    await resend.emails.send({
      from: config.resend.mailFrom,
      to,
      subject: 'Verify your Persona.ai account',
      html,
      text,
    });
    logger.info('Verification email sent', { to });
  } catch (error) {
    logger.error('Failed to send verification email', { to, error: error.message });
    throw error;
  }
};

export const sendWelcomeEmail = async (to, name) => {
  if (!resend) {
    logger.warn('Resend not configured, skipping welcome email', { to });
    return;
  }

  const email = {
    body: {
      name: name || to,
      intro: 'Welcome to Persona.ai! Your email has been verified successfully.',
      action: {
        instructions: "You're all set! Start exploring what Persona.ai has to offer.",
        button: {
          color: '#22BC66',
          text: 'Get Started',
          link: config.websiteUrl,
        },
      },
      outro: "Need help? Just reply to this email. We're happy to assist!",
    },
  };

  const html = mailgen.generate(email);
  let text = mailgen.generatePlaintext(email);

  try {
    await resend.emails.send({
      from: config.resend.mailFrom,
      to,
      subject: 'Welcome to Persona.ai!',
      html,
      text,
    });
    logger.info('Welcome email sent', { to });
  } catch (error) {
    logger.error('Failed to send welcome email', { to, error: error.message });
    throw error;
  }
};

export const sendPasswordResetEmail = async (to, otp) => {
  if (!resend) {
    logger.warn('Resend not configured, skipping password reset email', { to });
    return;
  }

  const email = {
    body: {
      name: to,
      intro: 'You requested a password reset.',
      action: {
        instructions: `Your password reset code is:`,
        button: {
          color: '#22BC66',
          text: otp,
          link: '#',
        },
      },
      outro:
        'This code expires in 10 minutes. If you did not request a password reset, please ignore this email.',
    },
  };

  const html = mailgen.generate(email);
  let text = mailgen.generatePlaintext(email);

  // Replace plaintext placeholder with OTP when present
  if (typeof text === 'string' && otp && text.includes('#')) {
    text = text.replace('#', otp);
  }

  try {
    await resend.emails.send({
      from: config.resend.mailFrom,
      to,
      subject: 'Reset your Persona.ai password',
      html,
      text,
    });
    logger.info('Password reset email sent', { to });
  } catch (error) {
    logger.error('Failed to send password reset email', { to, error: error.message });
    throw error;
  }
};
