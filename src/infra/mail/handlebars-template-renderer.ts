import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import { TemplateRenderer } from './template-renderer.port';

@Injectable()
export class HandlebarsTemplateRenderer implements TemplateRenderer {
  private readonly cache = new Map<string, Handlebars.TemplateDelegate>();

  async render<T extends object>(
    template: string,
    context: T,
  ): Promise<string> {
    let compiled = this.cache.get(template);
    if (!compiled) {
      compiled = Handlebars.compile(template, {
        strict: true,
        noEscape: false,
      });
      this.cache.set(template, compiled);
    }
    return Promise.resolve(compiled(context));
  }
}
