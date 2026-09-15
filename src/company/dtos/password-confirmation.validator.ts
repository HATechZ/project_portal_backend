import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'passwordConfirmation', async: false })
export class PasswordConfirmationValidator implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const input = args.object as { password?: unknown };
    return typeof value === 'string' && value === input.password;
  }

  defaultMessage(): string {
    return 'confirmPassword must match password';
  }
}
