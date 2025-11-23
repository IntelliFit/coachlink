import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { UpdateTemplateDto, UpdateTemplateResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        id,
        name,
        description,
        type,
        days
    } = await req.json() as UpdateTemplateDto;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
        }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_coach')
        .eq('id', userId)
        .single();

    if (userError || !user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    try {
        // 更新模板基本信息
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;

        let template;
        if (Object.keys(updateData).length > 0) {
            const { data, error: updateError } = await supabase
                .from("coach_plan_templates")
                .update(updateData)
                .eq("id", id)
                .eq("coach_id", userId)
                .select()
                .single();

            if (updateError) {
                console.error("Error updating template:", updateError);
                return NextResponse.json({
                    success: false,
                    message: "Failed to update template"
                }, { status: 500 });
            }

            template = data;
        } else {
            // 如果没有更新字段，直接获取现有模板
            const { data, error: fetchError } = await supabase
                .from("coach_plan_templates")
                .select("*")
                .eq("id", id)
                .eq("coach_id", userId)
                .single();

            if (fetchError) {
                console.error("Error fetching template:", fetchError);
                return NextResponse.json({
                    success: false,
                    message: "Template not found"
                }, { status: 404 });
            }

            template = data;
        }

        // 更新计划日和动作组（如果提供了days数据）
        if (days) {
            // 获取当前模板下的所有计划日
            const { data: existingDays, error: fetchDaysError } = await supabase
                .from("coach_plan_days")
                .select("id")
                .eq("plan_template_id", id);

            if (fetchDaysError) {
                console.error("Error fetching existing days:", fetchDaysError);
                return NextResponse.json({
                    success: false,
                    message: "Failed to fetch existing plan days"
                }, { status: 500 });
            }

            const existingDayIds = new Set((existingDays || []).map(day => day.id));
            const updatedDayIds = new Set<string>();

            // 处理每个计划日
            for (const day of days) {
                let createdDay;
                if (day.id) {
                    // 更新现有计划日
                    updatedDayIds.add(day.id);

                    const { data, error: dayError } = await supabase
                        .from("coach_plan_days")
                        .update({
                            day_index: day.day_index,
                            type: day.type,
                            note: day.note || null
                        })
                        .eq("id", day.id)
                        .eq("plan_template_id", id)
                        .select()
                        .single();

                    if (dayError) {
                        console.error("Error updating day:", dayError);
                        return NextResponse.json({
                            success: false,
                            message: "Failed to update plan day"
                        }, { status: 500 });
                    }

                    createdDay = data;
                } else {
                    // 创建新计划日
                    const { data, error: dayError } = await supabase
                        .from("coach_plan_days")
                        .insert({
                            plan_template_id: id,
                            day_index: day.day_index,
                            type: day.type,
                            note: day.note || null
                        })
                        .select()
                        .single();

                    if (dayError) {
                        console.error("Error creating day:", dayError);
                        return NextResponse.json({
                            success: false,
                            message: "Failed to create plan day"
                        }, { status: 500 });
                    }

                    createdDay = data;
                }

                // 处理动作组（如果提供了action_sets数据）
                if (day.action_sets) {
                    // 获取当前计划日下的所有动作组
                    const { data: existingActionSets, error: fetchActionSetsError } = await supabase
                        .from("coach_plan_action_sets")
                        .select("id")
                        .eq("day_id", createdDay.id);

                    if (fetchActionSetsError) {
                        console.error("Error fetching existing action sets:", fetchActionSetsError);
                        return NextResponse.json({
                            success: false,
                            message: "Failed to fetch existing action sets"
                        }, { status: 500 });
                    }

                    const existingActionSetIds = new Set((existingActionSets || []).map(set => set.id));
                    const updatedActionSetIds = new Set<string>();

                    // 处理每个动作组
                    for (const actionSet of day.action_sets) {
                        if (actionSet.id) {
                            // 更新现有动作组
                            updatedActionSetIds.add(actionSet.id);

                            const { error: actionSetError } = await supabase
                                .from("coach_plan_action_sets")
                                .update({
                                    action_id: actionSet.action_id,
                                    set_order: actionSet.set_order,
                                    sets: actionSet.sets,
                                    reps: actionSet.reps,
                                    intensity: actionSet.intensity || null,
                                    rest_seconds: actionSet.rest_seconds || null
                                })
                                .eq("id", actionSet.id)
                                .eq("day_id", createdDay.id);

                            if (actionSetError) {
                                console.error("Error updating action set:", actionSetError);
                                return NextResponse.json({
                                    success: false,
                                    message: "Failed to update action set"
                                }, { status: 500 });
                            }
                        } else {
                            // 创建新动作组
                            const { error: actionSetError } = await supabase
                                .from("coach_plan_action_sets")
                                .insert({
                                    day_id: createdDay.id,
                                    action_id: actionSet.action_id,
                                    set_order: actionSet.set_order,
                                    sets: actionSet.sets,
                                    reps: actionSet.reps,
                                    intensity: actionSet.intensity || null,
                                    rest_seconds: actionSet.rest_seconds || null
                                });

                            if (actionSetError) {
                                console.error("Error creating action set:", actionSetError);
                                return NextResponse.json({
                                    success: false,
                                    message: "Failed to create action set"
                                }, { status: 500 });
                            }
                        }
                    }

                    // 删除未更新的动作组
                    const actionSetsToDelete = Array.from(existingActionSetIds).filter(id => !updatedActionSetIds.has(id));
                    if (actionSetsToDelete.length > 0) {
                        const { error: deleteError } = await supabase
                            .from("coach_plan_action_sets")
                            .delete()
                            .in("id", actionSetsToDelete);

                        if (deleteError) {
                            console.error("Error deleting action sets:", deleteError);
                            return NextResponse.json({
                                success: false,
                                message: "Failed to delete action sets"
                            }, { status: 500 });
                        }
                    }
                }
            }

            // 删除未更新的计划日
            const daysToDelete = Array.from(existingDayIds).filter(id => !updatedDayIds.has(id));
            if (daysToDelete.length > 0) {
                // 先删除这些计划日下的所有动作组
                const { data: daysToDeleteData, error: fetchDaysToDeleteError } = await supabase
                    .from("coach_plan_days")
                    .select("id")
                    .in("id", daysToDelete);

                if (!fetchDaysToDeleteError && daysToDeleteData) {
                    const dayIdsToDelete = daysToDeleteData.map(day => day.id);
                    await supabase
                        .from("coach_plan_action_sets")
                        .delete()
                        .in("day_id", dayIdsToDelete);
                }

                // 再删除计划日
                const { error: deleteError } = await supabase
                    .from("coach_plan_days")
                    .delete()
                    .in("id", daysToDelete);

                if (deleteError) {
                    console.error("Error deleting days:", deleteError);
                    return NextResponse.json({
                        success: false,
                        message: "Failed to delete plan days"
                    }, { status: 500 });
                }
            }
        }

        return NextResponse.json<ApiData<UpdateTemplateResponseDto>>({
            success: true,
            message: "更新训练计划模板成功",
            data: {
                template
            }
        });
    } catch (error) {
        console.error("Error in update-template:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to update template"
        }, { status: 500 });
    }
}