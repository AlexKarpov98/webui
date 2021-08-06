import { Preferences } from './preferences.interface';

export interface User {
  id: number;
  uid: number;
  username: string;
  unixhash: string;
  smbhash: string;
  home: string;
  shell: string;
  full_name: string;
  builtin: boolean;
  smb: boolean;
  password_disabled: boolean;
  locked: boolean;
  sudo: boolean;
  sudo_nopasswd: boolean;
  sudo_commands: { [property: string]: any }[];
  microsoft_account: boolean;
  attributes: { preferences: Preferences };
  email: string;
  group: UserGroup;
  groups: { [property: string]: any }[];
  sshpubkey: string;
  local: boolean;
  id_type_both: boolean;
}

export interface UserGroup {
  id: number;
  bsdgrp_gid: number;
  bsdgrp_group: string;
  bsdgrp_builtin: boolean;
  bsdgrp_sudo: boolean;
  bsdgrp_sudo_nopasswd: boolean;
  bsdgrp_sudo_commands: { [property: string]: any }[];
  bsdgrp_smb: boolean;
}

export type DeleteUserParams = [
  /* id */ number,
  /* params */ { delete_group: true },
];
