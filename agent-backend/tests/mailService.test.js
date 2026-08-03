import { jest } from '@jest/globals';
import config from '../src/config/index.js';

describe('Mail Service', () => {
  let sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail;
  let mockResend;
  let mockMailgen;
  let mockLogger;

  const testEmail = 'test@example.com';
  const testOtp = '123456';
  const testName = 'Test User';

  beforeEach(async () => {
    jest.resetModules();

    // Mock dotenv to prevent loading .env file
    jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));

    // Mock resend
    mockResend = {
      emails: {
        send: jest.fn(),
      },
    };

    // Mock mailgen
    mockMailgen = {
      generate: jest.fn(),
      generatePlaintext: jest.fn(),
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Mock the mail config module
    jest.unstable_mockModule('../src/config/mail.config.js', () => ({
      resend: mockResend,
      mailgen: mockMailgen,
    }));

    // Mock the logger service
    jest.unstable_mockModule('../src/utils/index.js', () => ({
      loggerService: {
        getLogger: () => mockLogger,
      },
    }));

    // Import the mail service after mocks are set up
    const mailService = await import('../src/modules/mail/mail.service.js');
    sendVerificationEmail = mailService.sendVerificationEmail;
    sendWelcomeEmail = mailService.sendWelcomeEmail;
    sendPasswordResetEmail = mailService.sendPasswordResetEmail;

    // Set default mock return values
    mockMailgen.generate.mockReturnValue('<html>email html</html>');
    mockMailgen.generatePlaintext.mockReturnValue('email plaintext');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: testEmail,
            intro: 'Welcome to persona.hasanraiyan.me! Verify your email address.',
            action: expect.objectContaining({
              instructions: 'Your verification code is:',
              button: expect.objectContaining({
                color: '#22BC66',
                text: testOtp,
                link: '#',
              }),
            }),
            outro: expect.stringContaining('expires in 10 minutes'),
          }),
        })
      );

      expect(mockMailgen.generatePlaintext).toHaveBeenCalled();
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: config.resend.mailFrom,
        to: testEmail,
        subject: 'Verify your persona.hasanraiyan.me account',
        html: '<html>email html</html>',
        text: 'email plaintext',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Verification email sent', { to: testEmail });
    });

    it('should use provided email as name when name is not provided', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: testEmail,
          }),
        })
      );
    });

    it('should throw error when resend fails', async () => {
      const error = new Error('Resend API error');
      mockResend.emails.send.mockRejectedValue(error);

      await expect(sendVerificationEmail(testEmail, testOtp)).rejects.toThrow('Resend API error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send verification email', {
        to: testEmail,
        error: 'Resend API error',
      });
    });

    it('should log error details when sending fails', async () => {
      const error = new Error('Network error');
      mockResend.emails.send.mockRejectedValue(error);

      try {
        await sendVerificationEmail(testEmail, testOtp);
      } catch (err) {
        // Expected error
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send verification email', {
        to: testEmail,
        error: 'Network error',
      });
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail(testEmail, testName);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: testName,
            intro: 'Welcome to persona.hasanraiyan.me! Your email has been verified successfully.',
            action: expect.objectContaining({
              instructions: "You're all set! Start exploring what persona.hasanraiyan.me has to offer.",
              button: expect.objectContaining({
                color: '#22BC66',
                text: 'Get Started',
                link: config.websiteUrl,
              }),
            }),
            outro: expect.stringContaining('Need help?'),
          }),
        })
      );

      expect(mockMailgen.generatePlaintext).toHaveBeenCalled();
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: config.resend.mailFrom,
        to: testEmail,
        subject: 'Welcome to persona.hasanraiyan.me!',
        html: '<html>email html</html>',
        text: 'email plaintext',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Welcome email sent', { to: testEmail });
    });

    it('should use email as name when name is not provided', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail(testEmail, null);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: testEmail,
          }),
        })
      );
    });

    it('should use email as name when name is undefined', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail(testEmail, undefined);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: testEmail,
          }),
        })
      );
    });

    it('should use email as name when name is empty string', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail(testEmail, '');

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: testEmail,
          }),
        })
      );
    });

    it('should throw error when resend fails', async () => {
      const error = new Error('Resend API error');
      mockResend.emails.send.mockRejectedValue(error);

      await expect(sendWelcomeEmail(testEmail, testName)).rejects.toThrow('Resend API error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send welcome email', {
        to: testEmail,
        error: 'Resend API error',
      });
    });

    it('should include correct website URL in get started button', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail(testEmail, testName);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            action: expect.objectContaining({
              button: expect.objectContaining({
                link: config.websiteUrl,
              }),
            }),
          }),
        })
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendPasswordResetEmail(testEmail, testOtp);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: testEmail,
            intro: 'You requested a password reset.',
            action: expect.objectContaining({
              instructions: 'Your password reset code is:',
              button: expect.objectContaining({
                color: '#22BC66',
                text: testOtp,
                link: '#',
              }),
            }),
            outro: expect.stringContaining('expires in 10 minutes'),
          }),
        })
      );

      expect(mockMailgen.generatePlaintext).toHaveBeenCalled();
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: config.resend.mailFrom,
        to: testEmail,
        subject: 'Reset your persona.hasanraiyan.me password',
        html: '<html>email html</html>',
        text: 'email plaintext',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Password reset email sent', { to: testEmail });
    });

    it('should use provided email as name', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendPasswordResetEmail(testEmail, testOtp);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: testEmail,
          }),
        })
      );
    });

    it('should throw error when resend fails', async () => {
      const error = new Error('Resend API error');
      mockResend.emails.send.mockRejectedValue(error);

      await expect(sendPasswordResetEmail(testEmail, testOtp)).rejects.toThrow('Resend API error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to send password reset email', {
        to: testEmail,
        error: 'Resend API error',
      });
    });

    it('should include security notice in outro', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendPasswordResetEmail(testEmail, testOtp);

      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            outro: expect.stringContaining('If you did not request a password reset'),
          }),
        })
      );
    });
  });

  describe('Email content generation', () => {
    it('should generate both HTML and plaintext for verification email', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);

      expect(mockMailgen.generate).toHaveBeenCalledTimes(1);
      expect(mockMailgen.generatePlaintext).toHaveBeenCalledTimes(1);
    });

    it('should generate both HTML and plaintext for welcome email', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail(testEmail, testName);

      expect(mockMailgen.generate).toHaveBeenCalledTimes(1);
      expect(mockMailgen.generatePlaintext).toHaveBeenCalledTimes(1);
    });

    it('should generate both HTML and plaintext for password reset email', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendPasswordResetEmail(testEmail, testOtp);

      expect(mockMailgen.generate).toHaveBeenCalledTimes(1);
      expect(mockMailgen.generatePlaintext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should rethrow resend error for verification email', async () => {
      const customError = new Error('Invalid API key');
      mockResend.emails.send.mockRejectedValue(customError);

      await expect(sendVerificationEmail(testEmail, testOtp)).rejects.toBe(customError);
    });

    it('should rethrow resend error for welcome email', async () => {
      const customError = new Error('Invalid recipient');
      mockResend.emails.send.mockRejectedValue(customError);

      await expect(sendWelcomeEmail(testEmail, testName)).rejects.toBe(customError);
    });

    it('should rethrow resend error for password reset email', async () => {
      const customError = new Error('Rate limit exceeded');
      mockResend.emails.send.mockRejectedValue(customError);

      await expect(sendPasswordResetEmail(testEmail, testOtp)).rejects.toBe(customError);
    });

    it('should log error before throwing for verification email', async () => {
      const error = new Error('Send failed');
      mockResend.emails.send.mockRejectedValue(error);

      try {
        await sendVerificationEmail(testEmail, testOtp);
      } catch (err) {
        // Expected
      }

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send verification email'),
        expect.objectContaining({ to: testEmail })
      );
    });

    it('should log error before throwing for welcome email', async () => {
      const error = new Error('Send failed');
      mockResend.emails.send.mockRejectedValue(error);

      try {
        await sendWelcomeEmail(testEmail, testName);
      } catch (err) {
        // Expected
      }

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send welcome email'),
        expect.objectContaining({ to: testEmail })
      );
    });

    it('should log error before throwing for password reset email', async () => {
      const error = new Error('Send failed');
      mockResend.emails.send.mockRejectedValue(error);

      try {
        await sendPasswordResetEmail(testEmail, testOtp);
      } catch (err) {
        // Expected
      }

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send password reset email'),
        expect.objectContaining({ to: testEmail })
      );
    });
  });

  describe('Email configuration', () => {
    it('should use correct sender address for all emails', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);
      await sendWelcomeEmail(testEmail, testName);
      await sendPasswordResetEmail(testEmail, testOtp);

      const calls = mockResend.emails.send.mock.calls;
      calls.forEach((call) => {
        expect(call[0].from).toBe(config.resend.mailFrom);
      });
    });

    it('should use correct subjects for all email types', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Verify your persona.hasanraiyan.me account',
        })
      );

      mockResend.emails.send.mockClear();
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });
      await sendWelcomeEmail(testEmail, testName);
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Welcome to persona.hasanraiyan.me!',
        })
      );

      mockResend.emails.send.mockClear();
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });
      await sendPasswordResetEmail(testEmail, testOtp);
      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reset your persona.hasanraiyan.me password',
        })
      );
    });

    it('should use green color (#22BC66) for all action buttons', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);
      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            action: expect.objectContaining({
              button: expect.objectContaining({
                color: '#22BC66',
              }),
            }),
          }),
        })
      );

      mockMailgen.generate.mockClear();
      mockMailgen.generate.mockReturnValue('<html>email html</html>');
      await sendWelcomeEmail(testEmail, testName);
      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            action: expect.objectContaining({
              button: expect.objectContaining({
                color: '#22BC66',
              }),
            }),
          }),
        })
      );

      mockMailgen.generate.mockClear();
      mockMailgen.generate.mockReturnValue('<html>email html</html>');
      await sendPasswordResetEmail(testEmail, testOtp);
      expect(mockMailgen.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            action: expect.objectContaining({
              button: expect.objectContaining({
                color: '#22BC66',
              }),
            }),
          }),
        })
      );
    });
  });

  describe('Resend not configured (null)', () => {
    beforeEach(async () => {
      jest.resetModules();

      jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));

      jest.unstable_mockModule('../src/config/mail.config.js', () => ({
        resend: null,
        mailgen: mockMailgen,
      }));

      jest.unstable_mockModule('../src/utils/index.js', () => ({
        loggerService: {
          getLogger: () => mockLogger,
        },
      }));

      const mailService = await import('../src/modules/mail/mail.service.js');
      sendVerificationEmail = mailService.sendVerificationEmail;
      sendWelcomeEmail = mailService.sendWelcomeEmail;
      sendPasswordResetEmail = mailService.sendPasswordResetEmail;
    });

    it('should skip verification email and log warning when resend is null', async () => {
      await sendVerificationEmail(testEmail, testOtp);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Resend not configured, skipping verification email',
        {
          to: testEmail,
        }
      );
      expect(mockMailgen.generate).not.toHaveBeenCalled();
      expect(mockResend?.emails?.send).not.toHaveBeenCalled();
    });

    it('should skip welcome email and log warning when resend is null', async () => {
      await sendWelcomeEmail(testEmail, testName);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Resend not configured, skipping welcome email',
        {
          to: testEmail,
        }
      );
      expect(mockMailgen.generate).not.toHaveBeenCalled();
    });

    it('should skip password reset email and log warning when resend is null', async () => {
      await sendPasswordResetEmail(testEmail, testOtp);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Resend not configured, skipping password reset email',
        {
          to: testEmail,
        }
      );
      expect(mockMailgen.generate).not.toHaveBeenCalled();
    });
  });

  describe('Plaintext OTP replacement', () => {
    it('should replace # placeholder with OTP in verification email plaintext', async () => {
      mockMailgen.generatePlaintext.mockReturnValue('Code: # please use it');
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: `Code: ${testOtp} please use it`,
        })
      );
    });

    it('should replace # placeholder with OTP in password reset email plaintext', async () => {
      mockMailgen.generatePlaintext.mockReturnValue('Reset code: # enter below');
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendPasswordResetEmail(testEmail, testOtp);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: `Reset code: ${testOtp} enter below`,
        })
      );
    });

    it('should not replace when plaintext has no # placeholder', async () => {
      mockMailgen.generatePlaintext.mockReturnValue('No placeholder here');
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'No placeholder here',
        })
      );
    });

    it('should not replace when plaintext is not a string', async () => {
      mockMailgen.generatePlaintext.mockReturnValue(null);
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: null,
        })
      );
    });

    it('should not replace when OTP is empty', async () => {
      mockMailgen.generatePlaintext.mockReturnValue('Code: # please use it');
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, '');

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Code: # please use it',
        })
      );
    });
  });

  describe('Logging', () => {
    it('should log info message on successful verification email', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendVerificationEmail(testEmail, testOtp);

      expect(mockLogger.info).toHaveBeenCalledWith('Verification email sent', { to: testEmail });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log info message on successful welcome email', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendWelcomeEmail(testEmail, testName);

      expect(mockLogger.info).toHaveBeenCalledWith('Welcome email sent', { to: testEmail });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log info message on successful password reset email', async () => {
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' });

      await sendPasswordResetEmail(testEmail, testOtp);

      expect(mockLogger.info).toHaveBeenCalledWith('Password reset email sent', { to: testEmail });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should not log info when email sending fails', async () => {
      mockResend.emails.send.mockRejectedValue(new Error('Failed'));

      try {
        await sendVerificationEmail(testEmail, testOtp);
      } catch (err) {
        // Expected
      }

      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
