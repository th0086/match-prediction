import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CreateTeamDto, UpdateTeamDto } from "../admin/admin.dto";
import { Team, TeamDocument } from "./team.schema";

@Injectable()
export class TeamsService {
  constructor(@InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>) {}

  async listAll(options?: { activeOnly?: boolean }) {
    const filter = options?.activeOnly ? { isActive: true } : {};
    const teams = await this.teamModel.find(filter).sort({ name: 1 }).lean();
    return teams.map((team) => this.toDto(team));
  }

  async create(dto: CreateTeamDto) {
    const name = dto.name.trim();
    const duplicate = await this.teamModel.findOne({ name }).lean();
    if (duplicate) {
      throw new BadRequestException("Team name already exists.");
    }

    const team = await this.teamModel.create({
      name,
      country: dto.country?.trim() || undefined,
      iconUrl: dto.iconUrl?.trim() || undefined,
      isActive: dto.isActive ?? true,
    });

    return this.toDto(team.toObject());
  }

  async update(teamId: string, dto: UpdateTeamDto) {
    if (!Types.ObjectId.isValid(teamId)) {
      throw new BadRequestException("Invalid team id.");
    }

    const team = await this.teamModel.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new BadRequestException("Team not found.");
    }

    if (typeof dto.name === "string" && dto.name.trim()) {
      const name = dto.name.trim();
      const duplicate = await this.teamModel.findOne({ _id: { $ne: team._id }, name }).lean();
      if (duplicate) {
        throw new BadRequestException("Team name already exists.");
      }
      team.name = name;
    }

    if (typeof dto.country === "string") {
      team.country = dto.country.trim() || undefined;
    }

    if (typeof dto.iconUrl === "string") {
      team.iconUrl = dto.iconUrl.trim() || undefined;
    }

    if (typeof dto.isActive === "boolean") {
      team.isActive = dto.isActive;
    }

    await team.save();
    return this.toDto(team.toObject());
  }

  async ensureExistingTeamIds(teamIds: string[]) {
    const objectIds = teamIds.map((teamId) => {
      if (!Types.ObjectId.isValid(teamId)) {
        throw new BadRequestException("Invalid team id.");
      }
      return new Types.ObjectId(teamId);
    });

    const teams = await this.teamModel.find({ _id: { $in: objectIds }, isActive: true }).lean();
    if (teams.length !== teamIds.length) {
      throw new BadRequestException("One or more selected teams are invalid or inactive.");
    }

    return teams;
  }

  private toDto(team: Pick<TeamDocument, "_id" | "name" | "country" | "iconUrl" | "isActive"> | (Pick<Team, "name" | "country" | "iconUrl" | "isActive"> & { _id?: Types.ObjectId })) {
    return {
      id: team._id ? String(team._id) : "",
      name: team.name,
      country: team.country ?? null,
      iconUrl: team.iconUrl ?? null,
      isActive: team.isActive,
    };
  }
}