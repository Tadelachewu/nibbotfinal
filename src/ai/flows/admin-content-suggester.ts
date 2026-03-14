'use server';
/**
 * @fileOverview An AI tool to suggest draft content for menu or submenu sections.
 *
 * - suggestAdminContent - A function that generates draft content based on a prompt and optional context.
 * - AdminContentSuggesterInput - The input type for the suggestAdminContent function.
 * - AdminContentSuggesterOutput - The return type for the suggestAdminContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdminContentSuggesterInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A brief prompt describing the desired content, e.g., "a welcome message for a new user guide" or "description of our premium service."' +
        'Focus on what the content should be about and its purpose.'
    ),
  context: z
    .string()
    .optional()
    .describe(
      'Optional additional context or existing content to guide the AI, e.g., "Our brand values are innovation and customer focus."' +
        'This helps the AI generate more relevant and brand-aligned content.'
    ),
});
export type AdminContentSuggesterInput = z.infer<
  typeof AdminContentSuggesterInputSchema
>;

const AdminContentSuggesterOutputSchema = z.object({
  suggestedContent: z
    .string()
    .describe('The AI-generated draft content based on the provided prompt and context.'),
});
export type AdminContentSuggesterOutput = z.infer<
  typeof AdminContentSuggesterOutputSchema
>;

export async function suggestAdminContent(
  input: AdminContentSuggesterInput
): Promise<AdminContentSuggesterOutput> {
  return adminContentSuggesterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adminContentSuggesterPrompt',
  input: {schema: AdminContentSuggesterInputSchema},
  output: {schema: AdminContentSuggesterOutputSchema},
  prompt: `You are an AI content assistant for an admin panel.
Your task is to generate draft content for a menu or submenu section based on the user's prompt and any provided context.
The content should be clear, concise, and directly address the prompt.

Instructions:
- If context is provided, use it to inform the tone, style, and specific details of the generated content.
- The output should be a standalone piece of content suitable for a WYSIWYG editor.
- Avoid conversational intros or outros; just provide the content.

Prompt: {{{prompt}}}

{{#if context}}Context: {{{context}}}{{/if}}
`,
});

const adminContentSuggesterFlow = ai.defineFlow(
  {
    name: 'adminContentSuggesterFlow',
    inputSchema: AdminContentSuggesterInputSchema,
    outputSchema: AdminContentSuggesterOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
