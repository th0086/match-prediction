import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";

type UploadableFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  async uploadTeamIcon(file: UploadableFile) {
    if (!file.mimetype.startsWith("image/")) {
      throw new BadRequestException("Only image uploads are supported.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException("Image size must be 5MB or smaller.");
    }

    const endpoint = this.requiredEnv("DO_SPACES_ENDPOINT");
    const region = this.requiredEnv("DO_SPACES_REGION");
    const bucket = this.requiredEnv("DO_SPACES_BUCKET");
    const accessKeyId = this.requiredEnv("DO_SPACES_ACCESS_KEY");
    const secretAccessKey = this.requiredEnv("DO_SPACES_SECRET_KEY");
    const publicBaseUrl = this.requiredEnv("DO_SPACES_PUBLIC_BASE_URL").replace(/\/$/, "");
    const prefix = (this.configService.get<string>("DO_SPACES_TEAMS_PREFIX") ?? "teams").replace(/^\/+|\/+$/g, "");
    const extension = this.getExtension(file.originalname, file.mimetype);
    const objectKey = `${prefix}/${Date.now()}-${randomUUID()}${extension}`;

    const client = new S3Client({
      region,
      endpoint: `https://${endpoint}`,
      credentials: { accessKeyId, secretAccessKey },
    });

    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      throw new InternalServerErrorException(`Team icon upload failed: ${message}`);
    }

    return { key: objectKey, url: `${publicBaseUrl}/${objectKey}` };
  }

  private requiredEnv(key: string) {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured.`);
    }
    return value;
  }

  private getExtension(originalName: string, mimeType: string) {
    const lower = originalName.toLowerCase();
    if (lower.endsWith(".png")) return ".png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ".jpg";
    if (lower.endsWith(".webp")) return ".webp";
    if (lower.endsWith(".svg")) return ".svg";
    if (mimeType === "image/png") return ".png";
    if (mimeType === "image/webp") return ".webp";
    if (mimeType === "image/svg+xml") return ".svg";
    return ".jpg";
  }
}