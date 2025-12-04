import React from 'react';
import { MessageSquare, Quote } from 'lucide-react';
import { Avatar } from 'primereact/avatar';
import { Chip } from 'primereact/chip';
import { ProfileData } from './types';

interface CoachNotesSectionProps {
    data: ProfileData;
}

export const CoachNotesSection: React.FC<CoachNotesSectionProps> = ({ data }) => {
    const { notesData } = data;

    if (!notesData || notesData.length === 0) {
        return null;
    }

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-6">
                <MessageSquare className="text-primary" size={20} />
                教练观察与建议
            </h2>

            <div className="grid grid-cols-1 gap-6">
                {notesData.map((note) => (
                    <div key={note.id} className="relative bg-surface-50 rounded-xl p-6 border border-surface-300">
                        <Quote className="absolute top-4 right-4 text-surface-300" size={40} />
                        
                        <div className="flex items-center gap-3 mb-4">
                            <Avatar 
                                image={note.coachAvatar || undefined} 
                                label={!note.coachAvatar ? note.coachName.charAt(0) : undefined}
                                shape="circle" 
                                className="bg-surface-200 text-primary font-bold"
                            />
                            <div>
                                <div className="font-bold text-surface-900">{note.coachName}</div>
                                <div className="text-xs text-surface-500">{note.date}</div>
                            </div>
                        </div>

                        <p className="text-surface-700 leading-relaxed mb-4 relative z-10">
                            {note.content}
                        </p>

                        <div className="flex flex-wrap gap-2">
                            {note.tags.map((tag, index) => (
                                <Chip key={index} label={tag} className="text-xs bg-surface border border-blue-300 text-blue-300" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
