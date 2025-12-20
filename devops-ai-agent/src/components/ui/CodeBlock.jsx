import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Clipboard } from 'lucide-react';

const CodeBlock = ({ language, value }) => {
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setHasCopied(true);
    setTimeout(() => {
      setHasCopied(false);
    }, 2000); 
  };

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-1 rounded-t-md">
        <span className="text-xs font-sans text-gray-400">{language}</span>
        <button 
          onClick={handleCopy}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Copy code"
        >
          {hasCopied ? <Check size={16} /> : <Clipboard size={16} />}
        </button>
      </div>

      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus} 
        customStyle={{ 
          margin: 0, 
          padding: '1rem',
          backgroundColor: '#1E1E1E',
          borderBottomLeftRadius: '0.375rem',
          borderBottomRightRadius: '0.375rem',
        }}
        codeTagProps={{ 
          style: { 
            fontFamily: '"Fira Code", "Dank Mono", monospace',
            fontSize: '0.875rem' 
          } 
        }}
      >
        {value || ''}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;