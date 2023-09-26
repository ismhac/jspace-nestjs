import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User as UserModel, UserDocument } from './schemas/user.schema';
import mongoose, { Model } from 'mongoose';
import { genSaltSync, hashSync, compareSync } from 'bcryptjs';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose/dist/soft-delete-model';
import { IUser } from './users.interface';
import aqp from 'api-query-params';
import { User as UserDecorator } from 'src/decorator/customize';
import { Role, RoleDocument } from 'src/roles/schemas/role.schema';
import { USER_ROLE } from 'src/databases/sample';


@Injectable()
export class UsersService {

  constructor(
    @InjectModel(UserModel.name)
    private userModel: SoftDeleteModel<UserDocument>,

    @InjectModel(Role.name)
    private roleModule: SoftDeleteModel<RoleDocument>
  ) { }

  getHashPassword = (password: string) => {
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);
    return hash;
  }

  findUserByToken = async (refreshToken: string) => {
    return await this.userModel.findOne(
      { refreshToken }
    ).populate({
      path: "role",
      select: { name: 1 }
    });
  }

  updateUserToken = async (refreshToken: string, _id: string) => {
    return await this.userModel.updateOne(
      { _id },
      { refreshToken }
    )
  }

  // name , email , password, age, gender, address
  async register(user: RegisterUserDto) {
    const { name, email, password, age, gender, address } = user;
    // check email
    const isExist = await this.userModel.findOne({ email });
    if (isExist) {
      throw new BadRequestException(`Email: ${email} already exists in the system. Please use another email!`)
    }

    // fetch user role
    const userRole = await this.roleModule.findOne({ name: USER_ROLE });

    const hashPassword = this.getHashPassword(password);
    let newRegister = await this.userModel.create({
      name,
      email,
      password: hashPassword,
      age,
      gender,
      address,
      role: userRole?._id
    })
    return newRegister;
  }

  async create(createUserDto: CreateUserDto, @UserDecorator() user: IUser) {

    const { name, email, password, age,
      gender, address, role, company } = createUserDto;
    // check email
    const isExist = await this.userModel.findOne({ email });
    if (isExist) {
      throw new BadRequestException(`Email: ${email} already exists in the system. Please use another email!`)
    }
    const hashPassword = this.getHashPassword(password)
    let newUser = await this.userModel.create({
      name, email,
      password: hashPassword,
      age, gender, address, role, company,
      createdBy: {
        _id: user._id,
        email: user.email
      }
    });
    return newUser;
  }

  async findAll(currentPage: number, limit: number, queryString: string) {
    const { filter, sort, population } = aqp(queryString);
    delete filter.current;
    delete filter.pageSize;
    let offset = (+currentPage - 1) * (+limit);
    let defaultLimit = +limit ? +limit : 10;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.userModel.find(filter)
      .select('-password') // exclude password
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .populate(population)
      .exec();

    return {
      meta: {
        current: currentPage,
        pageSize: limit,
        pages: totalPages,
        total: totalItems
      },
      result
    }
  }

  async findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return 'not found user';
    }

    return await this.userModel.findOne({
      _id: id
    })
      .select('-password') // exclude
      .populate({ path: "role", select: { name: 1, _id: 1, } })
  }

  findOneByUsername(username: string) {
    return this.userModel.findOne({
      email: username
    }).populate({
      path: "role", select: { name: 1 }
    })
  }

  isValidPassword(password: string, hash: string) {
    return compareSync(password, hash);
  }

  async update(updateUserDto: UpdateUserDto, user: IUser) {
    return await this.userModel.updateOne(
      { _id: updateUserDto._id },
      {
        ...updateUserDto,
        updatedBy: {
          _id: user._id,
          email: user.email
        }
      }
    );
  }

  async remove(id: string, user: IUser) {
    // can not delete admin account: admin@gmail.com
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return 'Not found user'
    }

    const foundUser = await this.userModel.findById(id);
    if (foundUser.email === "admin@gmail.com") {
      throw new BadRequestException('Can not delete admin account');
    }
    await this.userModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email
        }
      }
    )
    return this.userModel.softDelete({ _id: id })
  }
}
