import { createServerSupabaseClient } from '@/lib/supabaseServerClient';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 更新用户档案的POST接口
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    
    // 检查用户是否已认证
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ 
        success: false, 
        message: '用户未认证' 
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // 获取请求数据
    const body = await request.json();
    
    // 准备要更新的数据
    const profileData = {
      full_name: body.full_name || null,
      nickname: body.nickname || null,
      phone: body.phone || null,
      address: body.address || null,
      gender: body.gender || null,
      birth_date: body.birth_date || null,
      height: body.height ? parseInt(body.height) : null,
      weight: body.weight ? parseInt(body.weight) : null,
      fitness_goal: body.fitness_goal || null,
      fitness_level: body.fitness_level || null,
      bio: body.bio || null,
      updated_at: new Date().toISOString()
    };
    
    // 检查用户档案是否已存在
    const { data: existingProfile, error: selectError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    let result;
    if (existingProfile) {
      // 更新现有档案
      const { data, error: updateError } = await supabase
        .from('user_profiles')
        .update(profileData)
        .eq('user_id', userId)
        .select('*')
        .single();
      
      if (updateError) {
        throw new Error(updateError.message);
      }
      
      result = data;
    } else {
      // 创建新档案
      const { data, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          ...profileData,
          user_id: userId,
          created_at: new Date().toISOString()
        })
        .select('*')
        .single();
      
      if (insertError) {
        throw new Error(insertError.message);
      }
      
      result = data;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '用户档案更新成功',
      data: result
    });
    
  } catch (error: any) {
    console.error('更新用户档案时出错:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || '更新用户档案失败' 
    }, { status: 500 });
  }
}