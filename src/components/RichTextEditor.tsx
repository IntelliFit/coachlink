'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Typography } from '@tiptap/extension-typography';
import { Markdown } from 'tiptap-markdown';
import { Video } from './tiptap-extensions/Video';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import {
    Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
    Quote, Code, Heading1, Heading2, Heading3, Image as ImageIcon,
    Link as LinkIcon, Undo, Redo, Minus, Table as TableIcon,
    Plus, Trash2, Columns, Rows, Video as VideoIcon
} from 'lucide-react';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

interface ErrorMessage {
    title: string;
    message: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
    content,
    onChange,
    placeholder = '在这里分享您的训练心得...'
}) => {
    // Dialog states
    const [tableDialog, setTableDialog] = useState(false);
    const [tableRows, setTableRows] = useState<number>(3);
    const [tableCols, setTableCols] = useState<number>(3);
    
    const [linkDialog, setLinkDialog] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    
    const [videoDialog, setVideoDialog] = useState(false);
    const [videoChoice, setVideoChoice] = useState<'upload' | 'url' | null>(null);
    const [videoUrl, setVideoUrl] = useState('');
    
    const [errorDialog, setErrorDialog] = useState(false);
    const [errorMessage, setErrorMessage] = useState<ErrorMessage>({ title: '', message: '' });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3, 4, 5, 6]
                }
            }),
            Underline,
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
            Video.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'rounded-lg',
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary-600 underline hover:text-primary-700',
                },
            }),
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'border-collapse table-auto w-full',
                },
            }),
            TableRow,
            TableHeader.configure({
                HTMLAttributes: {
                    class: 'border border-surface-300 bg-surface-100 font-bold px-4 py-2',
                },
            }),
            TableCell.configure({
                HTMLAttributes: {
                    class: 'border border-surface-300 px-4 py-2',
                },
            }),
            Typography,
            Markdown.configure({
                html: true,
                tightLists: true,
                tightListClass: 'tight',
                bulletListMarker: '-',
                linkify: true,
                breaks: true,
                transformPastedText: true,
                transformCopiedText: true,
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

    const showError = useCallback((title: string, message: string) => {
        setErrorMessage({ title, message });
        setErrorDialog(true);
    }, []);

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
                showError('图片过大', '图片大小不能超过 5MB，请选择更小的图片或使用图片压缩工具。');
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
    }, [editor, showError]);

    const addVideo = useCallback(() => {
        setVideoUrl('');
        setVideoChoice(null);
        setVideoDialog(true);
    }, []);

    const handleVideoUpload = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/mp4,video/webm,video/ogg';
        
        input.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            // 检查文件大小（限制为10MB，因为Base64会增加约33%）
            // Base64编码后约13MB，加上其他内容，总数据量应该在安全范围内
            if (file.size > 10 * 1024 * 1024) {
                showError(
                    '视频文件过大', 
                    '为确保发布成功，视频大小限制为 10MB。\n\n建议方案：\n\n1. 使用视频压缩工具：\n   • HandBrake (免费)\n   • 格式工厂\n   • 在线压缩工具\n\n2. 使用视频URL方式：\n   • 上传到云存储获取链接\n   • 使用视频托管服务\n   • 无大小限制\n\n3. 压缩设置建议：\n   • 分辨率：720p\n   • 比特率：1-2 Mbps\n   • 时长：控制在3分钟内'
                );
                return;
            }

            // 检查文件类型
            if (!file.type.startsWith('video/')) {
                showError('文件格式错误', '请选择视频文件（MP4、WebM 或 OGG 格式）');
                return;
            }

            // 创建本地预览URL
            const reader = new FileReader();
            reader.onload = (e) => {
                const videoUrl = e.target?.result as string;
                if (videoUrl && editor) {
                    // 检查Base64编码后的大小
                    const base64Size = videoUrl.length;
                    const estimatedMB = (base64Size / 1024 / 1024).toFixed(2);
                    
                    console.log(`视频Base64大小: ${estimatedMB}MB`);
                    
                    editor.chain().focus().setVideo({ src: videoUrl }).run();
                    setVideoDialog(false);
                }
            };
            reader.readAsDataURL(file);
        };

        input.click();
    }, [editor, showError]);

    const handleVideoUrlInsert = useCallback(() => {
        if (!videoUrl) return;

        // 简单验证URL格式
        try {
            new URL(videoUrl);
            editor?.chain().focus().setVideo({ src: videoUrl }).run();
            setVideoDialog(false);
            setVideoUrl('');
        } catch {
            showError('URL格式错误', '请输入有效的视频URL地址，例如：https://example.com/video.mp4');
        }
    }, [editor, videoUrl, showError]);

    const setLink = useCallback(() => {
        const previousUrl = editor?.getAttributes('link').href;
        setLinkUrl(previousUrl || '');
        setLinkDialog(true);
    }, [editor]);

    const handleLinkInsert = useCallback(() => {
        if (linkUrl === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        }
        setLinkDialog(false);
        setLinkUrl('');
    }, [editor, linkUrl]);

    const insertTable = useCallback(() => {
        setTableRows(3);
        setTableCols(3);
        setTableDialog(true);
    }, []);

    const handleTableInsert = useCallback(() => {
        if (tableRows > 0 && tableCols > 0 && tableRows <= 20 && tableCols <= 10) {
            editor?.chain().focus().insertTable({ 
                rows: tableRows, 
                cols: tableCols, 
                withHeaderRow: true 
            }).run();
            setTableDialog(false);
        }
    }, [editor, tableRows, tableCols]);

    const addColumnBefore = useCallback(() => {
        editor?.chain().focus().addColumnBefore().run();
    }, [editor]);

    const addColumnAfter = useCallback(() => {
        editor?.chain().focus().addColumnAfter().run();
    }, [editor]);

    const deleteColumn = useCallback(() => {
        editor?.chain().focus().deleteColumn().run();
    }, [editor]);

    const addRowBefore = useCallback(() => {
        editor?.chain().focus().addRowBefore().run();
    }, [editor]);

    const addRowAfter = useCallback(() => {
        editor?.chain().focus().addRowAfter().run();
    }, [editor]);

    const deleteRow = useCallback(() => {
        editor?.chain().focus().deleteRow().run();
    }, [editor]);

    const deleteTable = useCallback(() => {
        editor?.chain().focus().deleteTable().run();
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
                        tooltip="标题 1 (Markdown: # 标题)"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        isActive={editor.isActive('heading', { level: 2 })}
                        icon={Heading2}
                        tooltip="标题 2 (Markdown: ## 标题)"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        isActive={editor.isActive('heading', { level: 3 })}
                        icon={Heading3}
                        tooltip="标题 3 (Markdown: ### 标题)"
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
                        tooltip="引用 (Markdown: > 引用文字)"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        isActive={editor.isActive('codeBlock')}
                        icon={Code}
                        tooltip="代码块 (Markdown: ```代码```)"
                    />
                    <MenuButton
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        icon={Minus}
                        tooltip="分隔线 (Markdown: ---)"
                    />
                </div>

                {/* Media */}
                <div className="flex gap-1 pr-2 border-r border-surface-200">
                    <MenuButton
                        onClick={addImage}
                        icon={ImageIcon}
                        tooltip="插入图片 (最大5MB)"
                    />
                    <MenuButton
                        onClick={addVideo}
                        icon={VideoIcon}
                        tooltip="插入视频 (最大10MB)"
                    />
                    <MenuButton
                        onClick={setLink}
                        isActive={editor.isActive('link')}
                        icon={LinkIcon}
                        tooltip="插入链接"
                    />
                </div>

                {/* Table */}
                <div className="flex gap-1 pr-2 border-r border-surface-200">
                    <MenuButton
                        onClick={insertTable}
                        isActive={editor.isActive('table')}
                        icon={TableIcon}
                        tooltip="插入表格（快捷插入）"
                    />
                    {editor.isActive('table') && (
                        <>
                            <MenuButton
                                onClick={addRowAfter}
                                icon={Rows}
                                tooltip="添加行（在当前行后）"
                            />
                            <MenuButton
                                onClick={deleteRow}
                                icon={Trash2}
                                tooltip="删除当前行"
                            />
                            <div className="w-px h-6 bg-surface-200 self-center mx-1" />
                            <MenuButton
                                onClick={addColumnAfter}
                                icon={Columns}
                                tooltip="添加列（在当前列后）"
                            />
                            <MenuButton
                                onClick={deleteColumn}
                                icon={Trash2}
                                tooltip="删除当前列"
                            />
                        </>
                    )}
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

            {/* Markdown Hint & Media Tips */}
            <div className="px-4 py-2 bg-surface-50/50 border-t border-surface-100 text-xs text-surface-500">
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1">
                    <span>💡 支持Markdown语法：</span>
                    <span><code className="px-1 py-0.5 bg-surface-100 rounded"># 标题</code></span>
                    <span><code className="px-1 py-0.5 bg-surface-100 rounded">**粗体**</code></span>
                    <span><code className="px-1 py-0.5 bg-surface-100 rounded">*斜体*</code></span>
                    <span><code className="px-1 py-0.5 bg-surface-100 rounded">- 列表</code></span>
                    <span><code className="px-1 py-0.5 bg-surface-100 rounded">&gt; 引用</code></span>
                    <span><code className="px-1 py-0.5 bg-surface-100 rounded">| 表格 |</code></span>
                    <span><code className="px-1 py-0.5 bg-surface-100 rounded">[链接](url)</code></span>
                </div>
                <div className="text-[10px] text-surface-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>📊 表格：点击单元格编辑 • Tab切换</span>
                    <span>•</span>
                    <span>🎬 视频：本地上传≤10MB（长视频建议用URL）</span>
                    <span>•</span>
                    <span>🖼️ 图片：支持本地上传(≤5MB)</span>
                </div>
            </div>

            {/* Table Dialog */}
            <Dialog 
                visible={tableDialog} 
                onHide={() => setTableDialog(false)}
                header="插入表格"
                style={{ width: '400px' }}
                className="rounded-2xl"
                draggable={false}
                pt={{
                    root: { className: 'rounded-2xl' },
                    header: { className: 'px-6 py-4 border-b border-surface-100' },
                    content: { className: 'px-6 py-4' },
                    footer: { className: 'px-6 py-4 border-t border-surface-100' }
                }}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button 
                            label="取消" 
                            onClick={() => setTableDialog(false)}
                            className="p-button-text text-surface-600 hover:text-surface-900"
                        />
                        <Button 
                            label="插入表格" 
                            onClick={handleTableInsert}
                            disabled={tableRows < 1 || tableRows > 20 || tableCols < 1 || tableCols > 10}
                            className="bg-primary-500 border-none text-white rounded-xl font-bold px-6"
                        />
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-surface-700 mb-2">
                            行数（包含表头）
                        </label>
                        <InputNumber
                            value={tableRows}
                            onValueChange={(e) => setTableRows(e.value || 3)}
                            min={1}
                            max={20}
                            showButtons
                            className="w-full"
                            inputClassName="rounded-xl"
                        />
                        <p className="text-xs text-surface-500 mt-1">范围：1-20 行</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-surface-700 mb-2">
                            列数
                        </label>
                        <InputNumber
                            value={tableCols}
                            onValueChange={(e) => setTableCols(e.value || 3)}
                            min={1}
                            max={10}
                            showButtons
                            className="w-full"
                            inputClassName="rounded-xl"
                        />
                        <p className="text-xs text-surface-500 mt-1">范围：1-10 列</p>
                    </div>
                    <div className="text-xs text-surface-400 bg-surface-50 p-3 rounded-xl">
                        <p className="font-bold mb-1">💡 提示：</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>移动端建议不超过 4 列</li>
                            <li>桌面端建议不超过 10 列</li>
                            <li>插入后可以添加/删除行列</li>
                        </ul>
                    </div>
                </div>
            </Dialog>

            {/* Link Dialog */}
            <Dialog 
                visible={linkDialog} 
                onHide={() => setLinkDialog(false)}
                header="插入链接"
                style={{ width: '500px' }}
                className="rounded-2xl"
                draggable={false}
                pt={{
                    root: { className: 'rounded-2xl' },
                    header: { className: 'px-6 py-4 border-b border-surface-100' },
                    content: { className: 'px-6 py-4' },
                    footer: { className: 'px-6 py-4 border-t border-surface-100' }
                }}
                footer={
                    <div className="flex justify-end gap-3">
                        <Button 
                            label="取消" 
                            onClick={() => setLinkDialog(false)}
                            className="p-button-text text-surface-600 hover:text-surface-900"
                        />
                        {linkUrl && (
                            <Button 
                                label="删除链接" 
                                onClick={() => {
                                    setLinkUrl('');
                                    handleLinkInsert();
                                }}
                                className="p-button-outlined border-red-500 text-red-500 rounded-xl font-bold px-6"
                            />
                        )}
                        <Button 
                            label={linkUrl ? "更新链接" : "插入链接"}
                            onClick={handleLinkInsert}
                            className="bg-primary-500 border-none text-white rounded-xl font-bold px-6"
                        />
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-surface-700 mb-2">
                            链接URL
                        </label>
                        <InputText
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="w-full rounded-xl"
                            autoFocus
                        />
                        <p className="text-xs text-surface-500 mt-1">
                            输入完整的URL地址（包含 http:// 或 https://）
                        </p>
                    </div>
                    <div className="text-xs text-surface-400 bg-surface-50 p-3 rounded-xl">
                        <p className="font-bold mb-1">💡 提示：</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>先选中文字，再点击链接按钮</li>
                            <li>留空并确认可删除已有链接</li>
                            <li>支持内部链接和外部链接</li>
                        </ul>
                    </div>
                </div>
            </Dialog>

            {/* Video Dialog */}
            <Dialog 
                visible={videoDialog} 
                onHide={() => setVideoDialog(false)}
                header="插入视频"
                style={{ width: '500px' }}
                className="rounded-2xl"
                draggable={false}
                pt={{
                    root: { className: 'rounded-2xl' },
                    header: { className: 'px-6 py-4 border-b border-surface-100' },
                    content: { className: 'px-6 py-4' }
                }}
            >
                <div className="space-y-4">
                    {!videoChoice ? (
                        <>
                            <p className="text-sm text-surface-600 mb-4">
                                请选择视频来源：
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setVideoChoice('upload')}
                                    className="p-6 border-2 border-surface-200 rounded-2xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-surface-100 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
                                            <VideoIcon size={24} className="text-surface-600 group-hover:text-primary-600" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-surface-900 mb-1">本地上传</p>
                                            <p className="text-xs text-surface-500">支持 MP4/WebM/OGG</p>
                                            <p className="text-xs text-surface-400 mt-1">最大 10MB</p>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setVideoChoice('url')}
                                    className="p-6 border-2 border-surface-200 rounded-2xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-surface-100 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
                                            <LinkIcon size={24} className="text-surface-600 group-hover:text-primary-600" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-surface-900 mb-1">视频链接</p>
                                            <p className="text-xs text-surface-500">输入视频URL</p>
                                            <p className="text-xs text-surface-400 mt-1">无大小限制</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                            <div className="text-xs text-surface-400 bg-surface-50 p-3 rounded-xl">
                                <p className="font-bold mb-1">📝 建议：</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>简短视频(&lt;30秒内)建议本地上传</li>
                                    <li>长视频建议使用URL链接</li>
                                </ul>
                            </div>
                        </>
                    ) : videoChoice === 'upload' ? (
                        <div className="space-y-4">
                            <div className="text-center py-8">
                                <button
                                    onClick={handleVideoUpload}
                                    className="inline-flex flex-col items-center gap-4 p-8 border-2 border-dashed border-surface-300 rounded-2xl hover:border-primary-500 hover:bg-primary-50 transition-all"
                                >
                                    <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                                        <VideoIcon size={32} className="text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-surface-900 mb-1">选择视频文件</p>
                                        <p className="text-sm text-surface-500">点击选择本地视频</p>
                                    </div>
                                </button>
                            </div>
                            <div className="flex justify-end">
                                <Button 
                                    label="返回选择" 
                                    onClick={() => setVideoChoice(null)}
                                    className="p-button-text text-surface-600"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-surface-700 mb-2">
                                    视频URL
                                </label>
                                <InputText
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    placeholder="https://example.com/video.mp4"
                                    className="w-full rounded-xl"
                                    autoFocus
                                />
                                <p className="text-xs text-surface-500 mt-1">
                                    输入完整的视频URL地址
                                </p>
                            </div>
                            <div className="text-xs text-surface-400 bg-surface-50 p-3 rounded-xl">
                                <p className="font-bold mb-1">💡 支持的视频格式：</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>MP4：.mp4</li>
                                    <li>WebM：.webm</li>
                                    <li>OGG：.ogg, .ogv</li>
                                </ul>
                            </div>
                            <div className="flex justify-between">
                                <Button 
                                    label="返回选择" 
                                    onClick={() => setVideoChoice(null)}
                                    className="p-button-text text-surface-600"
                                />
                                <Button 
                                    label="插入视频" 
                                    onClick={handleVideoUrlInsert}
                                    disabled={!videoUrl}
                                    className="bg-primary-500 border-none text-white rounded-xl font-bold px-6"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </Dialog>

            {/* Error Dialog */}
            <Dialog 
                visible={errorDialog} 
                onHide={() => setErrorDialog(false)}
                header={errorMessage.title}
                style={{ width: '400px' }}
                className="rounded-2xl"
                draggable={false}
                pt={{
                    root: { className: 'rounded-2xl' },
                    header: { className: 'px-6 py-4 border-b border-surface-100 bg-red-50' },
                    content: { className: 'px-6 py-4' },
                    footer: { className: 'px-6 py-4 border-t border-surface-100' }
                }}
                footer={
                    <div className="flex justify-end">
                        <Button 
                            label="知道了" 
                            onClick={() => setErrorDialog(false)}
                            className="bg-red-500 border-none text-white rounded-xl font-bold px-6"
                        />
                    </div>
                }
            >
                <div className="text-sm text-surface-700 whitespace-pre-line">
                    {errorMessage.message}
                </div>
            </Dialog>
        </div>
    );
};

export default RichTextEditor;
