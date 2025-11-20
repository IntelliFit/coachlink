import type { PublishContentDto, PublishContentResponseDto } from "../publish-content/entity";

export type UpdateContentDto = Partial<PublishContentDto> & {
    id: string;
};

export type UpdateContentResponseDto = PublishContentResponseDto;