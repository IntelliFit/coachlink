import { isValidLocationCoordinates, validateLocationEquipment } from '@coachlink/core'
import type { LocationCoordinateSystem } from '@coachlink/core'

export function validateLocationInput(body: {
    country?: string | null;
    coordinate_system?: LocationCoordinateSystem | null;
    latitude?: number | null;
    longitude?: number | null;
    equipment_types?: unknown;
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
    return validateLocationEquipment(body.equipment_types);
}

/** WeChat sets this Referer on every mini-program request; pages cannot forge it. */
function isWeChatMiniProgramRequest(req: Request): boolean {
    return /^https:\/\/servicewechat\.com\//.test(req.headers.get('referer') || '');
}

/**
 * The coordinate system to store with new coordinates. An explicit client value wins;
 * WeChat (chooseLocation) always returns GCJ-02; anything else stays unknown (null)
 * rather than keeping a tag that no longer matches the new coordinates.
 * Returns undefined when the request does not touch coordinates.
 */
export function resolveCoordinateSystem(
    req: Request,
    body: { coordinate_system?: LocationCoordinateSystem | null; latitude?: number | null; longitude?: number | null },
): LocationCoordinateSystem | null | undefined {
    if (body.latitude === undefined && body.longitude === undefined) return body.coordinate_system;
    if (body.latitude == null || body.longitude == null) return null;
    if (body.coordinate_system !== undefined) return body.coordinate_system;
    return isWeChatMiniProgramRequest(req) ? 'gcj02' : null;
}
