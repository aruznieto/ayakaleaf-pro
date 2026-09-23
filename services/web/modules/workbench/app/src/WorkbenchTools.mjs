import { tool } from 'ai'
import { z } from 'zod'

/**
 * Declares the schemas of chat tools executed in the browser.
 * These tools omit server-side execute handlers so the AI SDK forwards calls
 * to the editor, where document state and user approval are available. The
 * client returns tool results and continues the conversation.
 */
export const CLIENT_TOOLS = {
  read_lines: tool({
    description:
      'Read a range of lines from the file currently open in the editor. ' +
      'Lines are 1-indexed and the range is inclusive. Returns an array of ' +
      '{ line, content }.',
    inputSchema: z.object({
      fromLine: z.number().int().describe('First line to read (1-indexed, inclusive).'),
      toLine: z.number().int().describe('Last line to read (1-indexed, inclusive).'),
    }),
  }),

  read_current_file: tool({
    description:
      'Read the entire contents of the file currently open in the editor, ' +
      'returned as an array of { line, content }.',
    inputSchema: z.object({}),
  }),

  search_file: tool({
    description:
      'Search the file currently open in the editor for a substring. Returns ' +
      'up to the first 10 matching lines as { line, content }.',
    inputSchema: z.object({
      query: z.string().describe('The substring to search for.'),
    }),
  }),

  get_diagnostics: tool({
    description:
      'Get the current LaTeX diagnostics (lint errors and warnings) for the ' +
      'file open in the editor, as an array of { fromLine, toLine, severity, message }.',
    inputSchema: z.object({}),
  }),

  list_files: tool({
    description: 'List the paths of all files in the current project.',
    inputSchema: z.object({}),
  }),

  create_file: tool({
    description:
      'Create a new file at the given project-relative path and open it in the editor.',
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          'Project-relative path of the file to create, e.g. "sections/intro.tex".'
        ),
    }),
  }),

  open_file: tool({
    description: 'Open an existing project file in the editor.',
    inputSchema: z.object({
      path: z.string().describe('Project-relative path of the file to open.'),
    }),
  }),

  replace_lines: tool({
    description:
      'Propose replacing a range of lines in the file open in the editor. The ' +
      'user is shown a diff and must approve it before the change is applied, ' +
      'so provide its project-relative path and the exact current content of ' +
      'the lines being replaced ' +
      '(so the edit can be located even if the document shifted) together with ' +
      'the full replacement content. Keep edits as small as possible.',
    inputSchema: z.object({
      path: z
        .string()
        .min(1)
        .describe('Project-relative path of the file whose content is being replaced.'),
      fromLine: z
        .number()
        .int()
        .describe('First line of the range to replace (1-indexed, inclusive).'),
      toLine: z
        .number()
        .int()
        .describe('Last line of the range to replace (1-indexed, inclusive).'),
      existingContent: z
        .string()
        .describe(
          'The exact current content of the lines being replaced, verbatim as it ' +
            'appears in the document.'
        ),
      newContent: z
        .string()
        .describe('The replacement content for those lines.'),
      rationale: z
        .string()
        .optional()
        .describe('A short explanation of why this change is being made.'),
    }),
  }),

  compile: tool({
    description: 'Compile the current project.',
    inputSchema: z.object({}),
  }),

  set_compiler: tool({
    description: 'Set the LaTeX compiler used to build the project.',
    inputSchema: z.object({
      compiler: z
        .enum(['pdflatex', 'xelatex', 'lualatex', 'latex'])
        .describe('The compiler to use.'),
    }),
  }),

  view_page: tool({
    description:
      'Render a page of the compiled PDF and return it as an image, so you can ' +
      'inspect the visual output of the document.',
    inputSchema: z.object({
      page: z.number().int().describe('1-indexed PDF page number to view.'),
    }),
  }),

  view_struct_tree: tool({
    description:
      'Get the structure tree (document outline) of the compiled PDF.',
    inputSchema: z.object({}),
  }),
}

export default CLIENT_TOOLS
