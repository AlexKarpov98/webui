import { untilDestroyed } from '@ngneat/until-destroy';
import { Group } from 'app/interfaces/group.interface';
import { FieldConfig } from 'app/pages/common/entity/entity-form/models/field-config.interface';
import { EditNfsAceComponent } from 'app/pages/storage/volumes/permissions/components/edit-nfs-ace/edit-nfs-ace.component';
import { EditPosixAceComponent } from 'app/pages/storage/volumes/permissions/components/edit-posix-ace/edit-posix-ace.component';
import { UserService } from 'app/services';

type Parent = EditNfsAceComponent | EditPosixAceComponent;

interface FormUserGroupLoaders {
  updateGroupSearchOptions: (value: string, parent: Parent, config: FieldConfig) => void;
  updateUserSearchOptions: (value: string, parent: Parent, config: FieldConfig) => void;
  loadMoreUserOptions: (length: number, parent: Parent, searchText: string, config: FieldConfig) => void;
  loadMoreGroupOptions: (length: number, parent: Parent, searchText: string, config: FieldConfig) => void;
}

export function getFormUserGroupLoaders(userService: UserService): FormUserGroupLoaders {
  return {
    updateGroupSearchOptions(value = '', parent: Parent, config: FieldConfig): void {
      userService.groupQueryDSCache(value).pipe(untilDestroyed(parent)).subscribe((groups) => {
        config.searchOptions = groups.map((group) => ({ label: group.group, value: group.group }));
      });
    },
    updateUserSearchOptions(value = '', parent: Parent, config: FieldConfig): void {
      userService.userQueryDSCache(value).pipe(untilDestroyed(parent)).subscribe((users) => {
        config.searchOptions = users.map((user) => ({ label: user.username, value: user.username }));
      });
    },
    loadMoreUserOptions(length: number, parent: Parent, searchText: string, config: FieldConfig): void {
      userService.userQueryDSCache(searchText, length)
        .pipe(untilDestroyed(parent))
        .subscribe((users) => {
          const userOptions = users.map((user) => ({ label: user.username, value: user.username }));

          if (searchText == '') {
            config.options = config.options.concat(userOptions);
          } else {
            config.searchOptions = config.searchOptions.concat(userOptions);
          }
        });
    },
    loadMoreGroupOptions(length: number, parent: Parent, searchText: string, config: FieldConfig): void {
      userService.groupQueryDSCache(searchText, false, length)
        .pipe(untilDestroyed(parent))
        .subscribe((groups: Group[]) => {
          const groupOptions = groups.map((group) => ({ label: group.group, value: group.group }));

          if (searchText == '') {
            config.options = config.options.concat(groupOptions);
          } else {
            config.searchOptions = config.searchOptions.concat(groupOptions);
          }
        });
    },
  };
}
