export const TEMPLATE_RENDERER = Symbol('TEMPLATE_RENDERER');

export interface TemplateRenderer {
  render<T extends object>(template: string, context: T): Promise<string>;
}
