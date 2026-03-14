'use server';
/**
 * @fileOverview An AI tool for administrators to translate content into multiple languages.
 *
 * - adminContentTranslator - A function that handles the content translation process.
 * - AdminContentTranslatorInput - The input type for the adminContentTranslator function.
 * - AdminContentTranslatorOutput - The return type for the adminContentTranslator function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdminContentTranslatorInputSchema = z.object({
  content: z.string().describe('The content to be translated.'),
  targetLanguage: z.string().describe('The target language for the translation (e.g., "Spanish", "fr", "Japanese").'),
});
export type AdminContentTranslatorInput = z.infer<typeof AdminContentTranslatorInputSchema>;

const AdminContentTranslatorOutputSchema = z.object({
  translatedContent: z.string().describe('The translated content.'),
});
export type AdminContentTranslatorOutput = z.infer<typeof AdminContentTranslatorOutputSchema>;

export async function adminContentTranslator(input: AdminContentTranslatorInput): Promise<AdminContentTranslatorOutput> {
  return adminContentTranslatorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adminContentTranslatorPrompt',
  input: {schema: AdminContentTranslatorInputSchema},
  output: {schema: AdminContentTranslatorOutputSchema},
  prompt: `You are an expert translator. Your task is to translate the provided content into the specified target language.

Content to translate: {{{content}}}
Target Language: {{{targetLanguage}}}

Translated Content:`,
});

const adminContentTranslatorFlow = ai.defineFlow(
  {
    name: 'adminContentTranslatorFlow',
    inputSchema: AdminContentTranslatorInputSchema,
    outputSchema: AdminContentTranslatorOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
