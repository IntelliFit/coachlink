import { BaseService } from "@/lib/baseService";
import type { ApiData } from "@/types/api";

import type {
    StreetliftingStatsDto,
    StreetliftingStatsResponseDto,
} from "@/app/api/streetlifting-index/stats/entity";
import type {
    StreetliftingListFormulasDto,
    StreetliftingListFormulasResponseDto,
} from "@/app/api/streetlifting-index/formulas/list/entity";
import type {
    StreetliftingListSubmissionsDto,
    StreetliftingListSubmissionsResponseDto,
} from "@/app/api/streetlifting-index/submissions/list/entity";
import type {
    StreetliftingCreateSubmissionDto,
    StreetliftingCreateSubmissionResponseDto,
} from "@/app/api/streetlifting-index/submissions/create/entity";
import type {
    StreetliftingListStoriesDto,
    StreetliftingListStoriesResponseDto,
} from "@/app/api/streetlifting-index/stories/list/entity";
import type {
    StreetliftingCreateStoryDto,
    StreetliftingCreateStoryResponseDto,
} from "@/app/api/streetlifting-index/stories/create/entity";
import type {
    StreetliftingListLocationsDto,
    StreetliftingListLocationsResponseDto,
} from "@/app/api/streetlifting-index/locations/list/entity";
import type {
    StreetliftingCreateLocationDto,
    StreetliftingCreateLocationResponseDto,
} from "@/app/api/streetlifting-index/locations/create/entity";
import type {
    StreetliftingUpdateLocationDto,
    StreetliftingUpdateLocationResponseDto,
} from "@/app/api/streetlifting-index/locations/update/entity";
import type { StreetliftingUploadLocationImageResponseDto } from "@/app/api/streetlifting-index/upload-location-image/entity";

class StreetliftingIndexService extends BaseService {
    async getStats(reqData?: StreetliftingStatsDto) {
        const res = await this.post<StreetliftingStatsResponseDto>("stats", reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listFormulas(reqData?: StreetliftingListFormulasDto) {
        const res = await this.post<StreetliftingListFormulasResponseDto>("formulas/list", reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listSubmissions(reqData?: StreetliftingListSubmissionsDto) {
        const res = await this.post<StreetliftingListSubmissionsResponseDto>("submissions/list", reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async createSubmission(reqData: StreetliftingCreateSubmissionDto) {
        const res = await this.post<StreetliftingCreateSubmissionResponseDto>("submissions/create", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listStories(reqData?: StreetliftingListStoriesDto) {
        const res = await this.post<StreetliftingListStoriesResponseDto>("stories/list", reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async createStory(reqData: StreetliftingCreateStoryDto) {
        const res = await this.post<StreetliftingCreateStoryResponseDto>("stories/create", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listLocations(reqData?: StreetliftingListLocationsDto) {
        const res = await this.post<StreetliftingListLocationsResponseDto>("locations/list", reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async createLocation(reqData: StreetliftingCreateLocationDto) {
        const res = await this.post<StreetliftingCreateLocationResponseDto>("locations/create", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async updateLocation(reqData: StreetliftingUpdateLocationDto) {
        const res = await this.post<StreetliftingUpdateLocationResponseDto>("locations/update", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async uploadLocationImage(file: File) {
        const formData = new FormData();
        formData.append("file", file);

        const resp = await fetch("/api/streetlifting-index/upload-location-image", {
            method: "POST",
            body: formData,
        });

        const contentType = resp.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const text = await resp.text();
            throw new Error(`上传失败（HTTP ${resp.status}）。${text}`);
        }

        const data = (await resp.json()) as ApiData<StreetliftingUploadLocationImageResponseDto>;
        if (data?.success) return data.data || null;
        throw new Error(data?.message || "上传失败");
    }
}

export const streetliftingIndexService = new StreetliftingIndexService("/api/streetlifting-index");
