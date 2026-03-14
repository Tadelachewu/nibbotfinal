
'use client';

import { Editor } from '@tinymce/tinymce-react';

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  title: string;
}

export function WysiwygEditor({ value, onChange, title }: WysiwygEditorProps) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-border">
      <Editor
        apiKey="no-api-key"
        value={value}
        onEditorChange={(content) => onChange(content)}
        init={{
          height: 450,
          menubar: true,
          plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
          ],
          toolbar: 'undo redo | blocks fontfamily fontsize | ' +
            'bold italic forecolor backcolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | help',
          content_style: 'body { font-family:Inter,Helvetica,Arial,sans-serif; font-size:16px; color: #1a1a1a; line-height: 1.6; }',
          skin: 'oxide',
          branding: false,
          promotion: false,
        }}
      />
    </div>
  );
}
