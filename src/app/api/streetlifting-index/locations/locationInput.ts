import { isValidLocationCoordinates } from '@coachlink/core'
import type { LocationCoordinateSystem } from '@coachlink/core'

export function validateLocationInput(body: {
    country?: string | null;
    coordinate_system?: LocationCoordinateSystem | null;
    latitude?: number | null;
    longitude?: number | null;
}): string | null {
    if (body.country != null && (typeof body.country !== 'string' || body.country.trim().length > 100)) {
        return '国家/地区名称不能超过100个字符';
    }
    if (body.coordinate_system != null && !['wgs84', 'gcj02'].includes(body.coordinate_system)) {
        return '不支持的坐标类型';
    }
    if ((body.latitude != null || body.longitude != null) && !isValidLocationCoordinates(body.latitude, body.longitude)) {
        return '请填写有效经纬度：纬度 -90～90，经度 -180～180';
    }
    return null;
}
