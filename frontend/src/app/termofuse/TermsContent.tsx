'use client';

import ReactMarkdown from 'react-markdown';
import { Title, Text, List, Anchor } from '@mantine/core';

interface TermsContentProps {
    content: string;
}

export default function TermsContent({ content }: TermsContentProps) {
    return (
        <ReactMarkdown
            components={{
                h1: ({ children }) => <Title order={1} mb="xl">{children}</Title>,
                h2: ({ children }) => <Title order={2} mt="xl" mb="md">{children}</Title>,
                h3: ({ children }) => <Title order={3} mt="lg" mb="sm">{children}</Title>,
                p: ({ children }) => <Text mb="md">{children}</Text>,
                ul: ({ children }) => <List withPadding mb="md" listStyleType="disc">{children}</List>,
                ol: ({ children }) => <List withPadding type="ordered" mb="md">{children}</List>,
                li: ({ children }) => <List.Item>{children}</List.Item>,
                a: ({ href, children }) => <Anchor href={href} target="_blank">{children}</Anchor>,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
