import React from 'react';
import Card from './ui/Card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ReportCard = ({ title, markdown }) => {
  if (!markdown) return null;
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      <article className="prose prose-invert max-w-none text-sm text-white">
        <div className="markdown-body text-white">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      </article>
    </Card>
  );
};

export default ReportCard;
