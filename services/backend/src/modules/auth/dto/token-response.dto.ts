import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Token expiration in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'User info' })
  user: {
    id: string;
    name: string;
    phone: string;
    role: string;
    projectIds: string[];
    currentProjectId: string;
    avatar?: string;
  };
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  refreshToken: string;
}
