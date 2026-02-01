'use client';

import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import {
    Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
    Quote, Code, Heading1, Heading2, Heading3, Image as ImageIcon,
    Link as LinkIcon, Undo, Redo, Minus
} from 'lucide-react';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
    content,
    onChange,
    placeholder = '在这里分享您的训练心得...'
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3]
                }
            }),
            Underline,
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary-600 underline hover:text-primary-700',
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] max-w-none p-5',
            },
        },
        immediatelyRender: false, // 修复 SSR 水合错误
    });

    // 当 content prop 变化时，更新编辑器内容
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    const addImage = useCallback(() => {
        // 创建文件输入元素
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            // 检查文件大小（限制为5MB）
            if (file.size > 5 * 1024 * 1024) {
                alert('图片大小不能超过 5MB');
                return;
            }

            // 创建本地预览URL
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageUrl = e.target?.result as string;
                if (imageUrl && editor) {
                    editor.chain().focus().setImage({ src: imageUrl }).run();
                }
            };
            reader.readAsDataURL(file);
        };

        input.click();
    }, [editor]);

    const setLink = useCallback(() => {
        const previousUrl = editor?.getAttributes('link').href;
        const url = window.prompt('请输入链接URL:', previousUrl);

        if (url === null) {
            return;
        }

        if (url === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) {
        return null;
    }

    const MenuButton = ({ 
        onClick, 
        isActive = false, 
        icon: Icon, 
        tooltip 
    }: { 
        onClick: () => void; 
        isActive?: boolean; 
        icon: React.ElementType; 
        tooltip: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            title={tooltip}
            className={`p-2 rounded-lg hover:bg-surface-100 transition-colors ${
                isActive ? 'bg-primary-50 text-primary-600' : 'text-surface-600'
            }`}
        >
            <Icon size={18} />
        </button>
    );

    return (
        <div className="border border-surface-200 rounded-2xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-primary-100 transition-all">
            {/* Toolbar */}
            <div className="border-b border-surface-100 bg-surface-50/50 px-3 py-2 flex flex-wrap gap-1">
                {/* Text Formatting */}
                <div className="flex gap-1 pr-2 border-r border-surface-200">
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        isActive={editor.isActive('bold')}
                        icon={Bold}
                        tooltip="粗体 (Ctrl+B)"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        isActive={editor.isActive('italic')}
                        icon={Italic}
                        tooltip="斜体 (Ctrl+I)"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        isActive={editor.isActive('underline')}
                        icon={UnderlineIcon}
                        tooltip="下划线 (Ctrl+U)"
                    />
                </div>

                {/* Headings */}
                <div className="flex gap-1 pr-2 border-r border-surface-200">
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        isActive={editor.isActive('heading', { level: 1 })}
                        icon={Heading1}
                        tooltip="标题 1"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        icon={Heading2}
                        tooltip="标题 2"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        isActive={editor.isActive('heading', { level: 3 })}
                        icon={Heading3}
                        tooltip="标题 3"
                    />
                </div>

                {/* Lists */}
                <div className="flex gap-1 pr-2 border-r border-surface-200">
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        isActive={editor.isActive('bulletList')}
                        icon={List}
                        tooltip="无序列表"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        isActive={editor.isActive('orderedList')}
                        icon={ListOrdered}
                        tooltip="有序列表"
                    />
                </div>

                {/* Special */}
                <div className="flex gap-1 pr-2 border-r border-surface-200">
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        isActive={editor.isActive('blockquote')}
                        icon={Quote}
                        tooltip="引用"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        isActive={editor.isActive('codeBlock')}
                        icon={Code}
                        tooltip="代码块"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        icon={Minus}
                        tooltip="分隔线"
                    />
                </div>

                {/* Media */}
                <div className="flex gap-1 pr-2 border-r border-surface-200">
                    <MenuButton
                        onClick={addImage}
                        icon={ImageIcon}
                        tooltip="插入图片"
                    />
                    <MenuButton
                        onClick={setLink}
                        isActive={editor.isActive('link')}
                        icon={LinkIcon}
                        tooltip="插入链接"
                    />
                </div>

                {/* Undo/Redo */}
                <div className="flex gap-1">
                    <MenuButton
                        onClick={() => editor.chain().focus().undo().run()}
                        icon={Undo}
                        tooltip="撤销 (Ctrl+Z)"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().redo().run()}
                        icon={Redo}
                        tooltip="重做 (Ctrl+Y)"
                    />
                </div>
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} className="min-h-[300px]" />

        </div>
    );
};

export default RichTextEditor;
