import { DiffEditor as MonacoDiffEditor, Editor as MonacoEditor, type DiffEditorProps, type EditorProps } from '@monaco-editor/react';
import { useTheme } from 'next-themes';

export { useMonaco } from '@monaco-editor/react';

export function Editor(props: EditorProps) {
  const { resolvedTheme } = useTheme();

  return <MonacoEditor {...props} theme={resolvedTheme === 'light' ? 'light' : 'vs-dark'} />;
}

export function DiffEditor(props: DiffEditorProps) {
  const { resolvedTheme } = useTheme();

  return <MonacoDiffEditor {...props} theme={resolvedTheme === 'light' ? 'light' : 'vs-dark'} />;
}
