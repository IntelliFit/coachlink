import { describe, expect, it } from "vitest";
import { canViewPrivateCoachFields, coachViewForViewer, toPublicCoachView } from "./coachPublicView";

const coachRow = {
    id: "coach-1",
    user_id: "user-coach",
    name: "刘三乐",
    title: "27+项世界记录保持者",
    specialties: ["力量举"],
    coach_track: "professional",
    address: "北京市海淀区",
    latitude: 39.99,
    longitude: 116.3,
    payment_mode: "alipay_api",
    payment_qr_codes: [{ url: "https://example.com/qr.png" }],
    allow_personal_qrcode: false,
    invitation_code: "666666",
    invitation_mode: "exclusive",
    search_vector: "'27':2B",
    huifu_id: "6666000202387586",
    huifu_card_token: "10066555801",
    huifu_apply_no: "apply-1",
    huifu_open_msg: "ok",
    huifu_business_status: "opened",
    huifu_resp_business: "[]",
    huifu_open_status: "opened",
    profile: {
        teachingPhilosophy: "循序渐进",
        contactEmail: "coach@example.com",
        contactPhone: "13800000000",
        socialLinks: { weibo: "https://weibo.com/x" },
    },
};

const PRIVATE_KEYS = [
    "payment_mode",
    "payment_qr_codes",
    "allow_personal_qrcode",
    "invitation_code",
    "invitation_mode",
    "search_vector",
    "huifu_id",
    "huifu_card_token",
    "huifu_apply_no",
    "huifu_open_msg",
    "huifu_business_status",
    "huifu_resp_business",
];

const guest = { userId: null, isAdmin: false };
const student = { userId: "user-student", isAdmin: false };
const owner = { userId: "user-coach", isAdmin: false };
const admin = { userId: "user-admin", isAdmin: true };

describe("toPublicCoachView", () => {
    it("drops payment, invitation and payment-account fields", () => {
        const view = toPublicCoachView(coachRow);
        for (const key of PRIVATE_KEYS) expect(view).not.toHaveProperty(key);
    });

    it("keeps what public pages show, including location and whether payments are open", () => {
        const view = toPublicCoachView(coachRow);
        expect(view).toMatchObject({
            id: "coach-1",
            user_id: "user-coach",
            name: "刘三乐",
            title: "27+项世界记录保持者",
            coach_track: "professional",
            address: "北京市海淀区",
            latitude: 39.99,
            huifu_open_status: "opened",
        });
        expect(view.profile).toMatchObject({ teachingPhilosophy: "循序渐进" });
    });

    it("drops contact details unless asked to keep them", () => {
        expect(toPublicCoachView(coachRow).profile).not.toHaveProperty("contactPhone");
        expect(toPublicCoachView(coachRow).profile).not.toHaveProperty("contactEmail");
        expect(toPublicCoachView(coachRow).profile).not.toHaveProperty("socialLinks");
        expect(toPublicCoachView(coachRow, { keepContact: true }).profile).toMatchObject({
            contactPhone: "13800000000",
            contactEmail: "coach@example.com",
        });
    });

    it("does not mutate the input row", () => {
        const before = JSON.stringify(coachRow);
        toPublicCoachView(coachRow);
        expect(JSON.stringify(coachRow)).toBe(before);
    });

    it("passes through empty values", () => {
        expect(toPublicCoachView(null)).toBeNull();
        expect(toPublicCoachView(undefined)).toBeUndefined();
    });
});

describe("coachViewForViewer", () => {
    it("gives the full row to the coach themselves and to admins", () => {
        expect(canViewPrivateCoachFields(owner, coachRow)).toBe(true);
        expect(canViewPrivateCoachFields(admin, coachRow)).toBe(true);
        expect(coachViewForViewer(owner, coachRow)).toBe(coachRow);
        expect(coachViewForViewer(admin, coachRow)).toHaveProperty("invitation_code", "666666");
    });

    it("hides private fields from guests and other users", () => {
        for (const viewer of [guest, student]) {
            expect(canViewPrivateCoachFields(viewer, coachRow)).toBe(false);
            const view = coachViewForViewer(viewer, coachRow);
            for (const key of PRIVATE_KEYS) expect(view).not.toHaveProperty(key);
        }
    });

    it("does not treat a missing user id as a match", () => {
        expect(canViewPrivateCoachFields(guest, { user_id: null })).toBe(false);
    });
});
