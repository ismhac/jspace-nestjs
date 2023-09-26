import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Permission, PermissionDocument } from 'src/permissions/schemas/permission.schema';
import { Role, RoleDocument } from 'src/roles/schemas/role.schema';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { ADMIN_ROLE, INIT_PERMISSIONS, USER_ROLE } from './sample';

@Injectable()
export class DatabasesService implements OnModuleInit {

    private readonly logger = new Logger(DatabasesService.name);

    constructor(
        @InjectModel(User.name)
        private userModel: SoftDeleteModel<UserDocument>,

        @InjectModel(Permission.name)
        private permissionModel: SoftDeleteModel<PermissionDocument>,

        @InjectModel(Role.name)
        private roleModel: SoftDeleteModel<RoleDocument>,

        private configService: ConfigService,
        private userService: UsersService
    ) { }

    async onModuleInit() {
        const isInit = this.configService.get<string>('SHOULD_INIT');
        if (Boolean(isInit)) {

            const countUser = await this.userModel.count({});
            const countPermission = await this.permissionModel.count({});
            const countRole = await this.roleModel.count({});

            // create permission
            if (countPermission === 0) {
                await this.permissionModel.insertMany(INIT_PERMISSIONS); // bulk create 
            }

            // create role
            if (countRole === 0) {
                const permissions = await this.permissionModel.find({}).select("_id");
                await this.roleModel.insertMany([ // bulk create 
                    {
                        name: ADMIN_ROLE,
                        description: "Admin has full permissions",
                        isActive: true,
                        permissions: permissions
                    },
                    {
                        name: USER_ROLE,
                        description: "User/Candidate in system",
                        isActive: true,
                        permissions: [] // not set permission, just create role
                    },
                ]);
            }

            // create user
            if (countUser === 0) {
                const adminRole = await this.roleModel.findOne({ name: ADMIN_ROLE });
                const userRole = await this.roleModel.findOne({ name: USER_ROLE });
                await this.userModel.insertMany([   // bulk create
                    {
                        name: "Luffy",
                        email: "admin@gmail.com",
                        password: this.userService.getHashPassword(this.configService.get<string>('INIT_PASSWORD')),
                        age: 20,
                        gender: "MALE",
                        address: "VietNam",
                        role: adminRole?._id,
                    },
                    {
                        name: "Zoro",
                        email: "zoro@gmail.com",
                        password: this.userService.getHashPassword(this.configService.get<string>('INIT_PASSWORD')),
                        age: 24,
                        gender: "MALE",
                        address: "VietNam",
                        role: adminRole?._id,
                    },
                    {
                        name: "Black Beard",
                        email: "rauden@gmail.com",
                        password: this.userService.getHashPassword(this.configService.get<string>('INIT_PASSWORD')),
                        age: 55,
                        gender: "MALE",
                        address: "VietNam",
                        role: userRole?._id,
                    },
                ])
            }

            // check isCreate sample data
            if (countUser > 0 && countPermission > 0 && countRole > 0) {
                this.logger.log("==> Already init sample data");
            }
        }
    }
}