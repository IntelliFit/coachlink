import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        // 获取所有已审核的教练及其专长
        const { data: coaches, error } = await supabase
            .from("coaches")
            .select("specialties")
            .eq("status", "approved");

        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message
            });
        }

        // 统计每个专长的出现频率
        const specialtyCount: Record<string, number> = {};
        
        if (coaches) {
            coaches.forEach(coach => {
                // 确保 specialties 是数组且不为空
                if (coach.specialties && Array.isArray(coach.specialties) && coach.specialties.length > 0) {
                    coach.specialties.forEach((specialty: string) => {
                        if (specialty && typeof specialty === 'string' && specialty.trim()) {
                            specialtyCount[specialty.trim()] = (specialtyCount[specialty.trim()] || 0) + 1;
                        }
                    });
                }
            });
        }

        // 转换为数组并按频率排序
        const specialties = Object.entries(specialtyCount)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count) // 按频率降序排序
            .map(item => item.name);

        return NextResponse.json({
            success: true,
            message: '获取成功',
            data: {
                specialties
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            message: error.message || '获取专长失败'
        });
    }
}

