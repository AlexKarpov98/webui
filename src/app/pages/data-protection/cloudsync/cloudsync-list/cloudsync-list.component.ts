import { Component, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { EntityDialogComponent } from 'app/pages/common/entity/entity-dialog/entity-dialog.component';
import { CloudSyncTaskUi } from 'app/interfaces/cloud-sync-task.interface';
import {
  EntityTableComponent,
  InputTableConf,
  EntityTableAction,
} from 'app/pages/common/entity/entity-table/entity-table.component';
import {
  AppLoaderService,
  CloudCredentialService,
  DialogService,
  JobService,
  TaskService,
  WebSocketService,
} from 'app/services';
import { DialogFormConfiguration } from 'app/pages/common/entity/entity-dialog/dialog-form-configuration.interface';
import { T } from 'app/translate-marker';
import { EntityUtils } from 'app/pages/common/entity/utils';
import globalHelptext from 'app/helptext/global-helptext';
import helptext from 'app/helptext/data-protection/cloudsync/cloudsync-form';
import { CloudsyncFormComponent } from 'app/pages/data-protection/cloudsync/cloudsync-form/cloudsync-form.component';
import { ModalService } from 'app/services/modal.service';
import { EntityJob } from 'app/interfaces/entity-job.interface';
import { EntityJobState } from 'app/enums/entity-job-state.enum';
import { TransferMode } from 'app/enums/transfer-mode.enum';

@Component({
  selector: 'app-cloudsync-list',
  template: '<entity-table [title]="title" [conf]="this"></entity-table>',
  providers: [JobService, TaskService, CloudCredentialService],
})
export class CloudsyncListComponent implements InputTableConf, OnDestroy {
  title = T('Cloud Sync Tasks');
  queryCall: 'cloudsync.query' = 'cloudsync.query';
  route_add: string[] = ['tasks', 'cloudsync', 'add'];
  route_add_tooltip = 'Add Cloud Sync Task';
  route_edit: string[] = ['tasks', 'cloudsync', 'edit'];
  wsDelete: 'cloudsync.delete' = 'cloudsync.delete';
  entityList: EntityTableComponent;
  asyncView = true;

  columns: any[] = [
    { name: T('Description'), prop: 'description', always_display: true },
    { name: T('Credential'), prop: 'credential', hidden: true },
    { name: T('Direction'), prop: 'direction', hidden: true },
    { name: T('Transfer Mode'), prop: 'transfer_mode', hidden: true },
    { name: T('Path'), prop: 'path', hidden: true },
    {
      name: T('Schedule'),
      prop: 'cron_schedule',
      hidden: true,
      widget: {
        icon: 'calendar-range',
        component: 'TaskScheduleListComponent',
      },
    },
    { name: T('Frequency'), prop: 'frequency', enableMatTooltip: true },
    { name: T('Next Run'), prop: 'next_run', hidden: true },
    {
      name: T('Status'),
      prop: 'state',
      state: 'state',
      button: true,
    },
    { name: T('Enabled'), prop: 'enabled' },
  ];
  rowIdentifier = 'description';
  config: any = {
    paging: true,
    sorting: { columns: this.columns },
    deleteMsg: {
      title: T('Cloud Sync Task'),
      key_props: ['description'],
    },
  };
  private onModalClose: Subscription;

  constructor(
    protected router: Router,
    protected ws: WebSocketService,
    protected translateService: TranslateService,
    protected dialog: DialogService,
    protected job: JobService,
    protected aroute: ActivatedRoute,
    protected matDialog: MatDialog,
    protected modalService: ModalService,
    protected cloudCredentialService: CloudCredentialService,
    protected loader: AppLoaderService,
    protected taskService: TaskService,
  ) {}

  afterInit(entityList: EntityTableComponent): void {
    this.entityList = entityList;
    this.onModalClose = this.modalService.onClose$.subscribe(() => {
      this.entityList.getData();
    });
  }

  resourceTransformIncomingRestData(data: CloudSyncTaskUi[]): CloudSyncTaskUi[] {
    return data.map((task) => {
      task.credential = task.credentials.name;
      task.cron_schedule = `${task.schedule.minute} ${task.schedule.hour} ${task.schedule.dom} ${task.schedule.month} ${task.schedule.dow}`;
      task.frequency = this.taskService.getTaskCronDescription(task.cron_schedule);
      task.next_run = this.taskService.getTaskNextRun(task.cron_schedule);

      if (task.job === null) {
        task.state = { state: EntityJobState.Pending };
      } else {
        task.state = { state: task.job.state };
        this.job.getJobStatus(task.job.id).subscribe((job: EntityJob) => {
          task.state = { state: job.state };
          task.job = job;
        });
      }

      return task;
    });
  }

  getActions(parentrow: any): EntityTableAction[] {
    return [
      {
        actionName: parentrow.description,
        id: 'run_now',
        label: T('Run Now'),
        icon: 'play_arrow',
        name: 'run',
        onClick: (row: any) => {
          this.dialog
            .confirm({ title: T('Run Now'), message: T('Run this cloud sync now?'), hideCheckBox: true })
            .subscribe((res: boolean) => {
              if (res) {
                row.state = { state: EntityJobState.Running };
                this.ws.call('cloudsync.sync', [row.id]).subscribe(
                  (jobId: number) => {
                    this.dialog.Info(
                      T('Task Started'),
                      T('Cloud sync <i>') + row.description + T('</i> has started.'),
                      '500px',
                      'info',
                      true,
                    );
                    this.job.getJobStatus(jobId).subscribe((job: EntityJob) => {
                      row.state = { state: job.state };
                      row.job = job;
                    });
                  },
                  (err) => {
                    new EntityUtils().handleWSError(this.entityList, err);
                  },
                );
              }
            });
        },
      },
      {
        actionName: parentrow.description,
        id: 'stop',
        name: 'stop',
        label: T('Stop'),
        icon: 'stop',
        onClick: (row: any) => {
          this.dialog
            .confirm({
              title: T('Stop'),
              message: T('Stop this cloud sync?'),
              hideCheckBox: true,
            })
            .subscribe((res: boolean) => {
              if (res) {
                this.ws.call('cloudsync.abort', [row.id]).subscribe(
                  (wsRes) => {
                    this.dialog.Info(
                      T('Task Stopped'),
                      T('Cloud sync <i>') + row.description + T('</i> stopped.'),
                      '500px',
                      'info',
                      true,
                    );
                  },
                  (wsErr) => {
                    new EntityUtils().handleWSError(this.entityList, wsErr);
                  },
                );
              }
            });
        },
      },
      {
        actionName: parentrow.description,
        id: 'dryrun',
        name: 'dryrun',
        label: helptext.action_button_dry_run,
        icon: 'sync',
        onClick: (row: any) => {
          this.dialog
            .confirm({
              title: helptext.dry_run_title,
              message: helptext.dry_run_dialog,
              hideCheckBox: true,
            })
            .subscribe((res: boolean) => {
              if (res) {
                this.ws.call('cloudsync.sync', [row.id, { dry_run: true }]).subscribe(
                  (jobId: number) => {
                    this.dialog.Info(
                      T('Task Started'),
                      T('Cloud sync <i>') + row.description + T('</i> has started.'),
                      '500px',
                      'info',
                      true,
                    );
                    this.job.getJobStatus(jobId).subscribe((job: EntityJob) => {
                      row.state = { state: job.state };
                      row.job = job;
                    });
                  },
                  (err) => {
                    new EntityUtils().handleWSError(this.entityList, err);
                  },
                );
              }
            });
        },
      },
      {
        actionName: parentrow.description,
        id: 'restore',
        name: 'restore',
        label: T('Restore'),
        icon: 'restore',
        onClick: (row: any) => {
          const parent = this;
          const conf: DialogFormConfiguration = {
            title: T('Restore Cloud Sync Task'),
            fieldConfig: [
              {
                type: 'input',
                name: 'description',
                placeholder: helptext.description_placeholder,
                tooltip: helptext.description_tooltip,
                validation: helptext.description_validation,
                required: true,
              },
              {
                type: 'select',
                name: 'transfer_mode',
                placeholder: helptext.transfer_mode_placeholder,
                validation: helptext.transfer_mode_validation,
                required: true,
                options: [
                  { label: T('SYNC'), value: TransferMode.Sync },
                  { label: T('COPY'), value: TransferMode.Copy },
                ],
                value: TransferMode.Copy,
              },
              {
                type: 'paragraph',
                name: 'transfer_mode_warning',
                paraText: helptext.transfer_mode_warning_copy,
                isLargeText: true,
                paragraphIcon: 'add_to_photos',
              },
              {
                type: 'explorer',
                explorerType: 'directory',
                name: 'path',
                placeholder: helptext.path_placeholder,
                tooltip: helptext.path_tooltip,
                validation: helptext.path_validation,
                initial: '/mnt',
                required: true,
              },
            ],
            saveButtonText: T('Restore'),
            afterInit(entityDialog: EntityDialogComponent) {
              entityDialog.formGroup.get('transfer_mode').valueChanges.subscribe((mode) => {
                const paragraph = conf.fieldConfig.find((config) => config.name === 'transfer_mode_warning');
                switch (mode) {
                  case TransferMode.Sync:
                    paragraph.paraText = helptext.transfer_mode_warning_sync;
                    paragraph.paragraphIcon = 'sync';
                    break;
                  default:
                    paragraph.paraText = helptext.transfer_mode_warning_copy;
                    paragraph.paragraphIcon = 'add_to_photos';
                }
              });
            },
            customSubmit(entityDialog: EntityDialogComponent) {
              parent.loader.open();
              parent.ws.call('cloudsync.restore', [row.id, entityDialog.formValue]).subscribe(
                (res) => {
                  entityDialog.dialogRef.close(true);
                  parent.entityList.getData();
                },
                (err) => {
                  parent.loader.close();
                  new EntityUtils().handleWSError(entityDialog, err, parent.dialog);
                },
              );
            },
          };
          this.dialog.dialogFormWide(conf);
        },
      },
      {
        id: 'edit',
        actionName: parentrow.description,
        name: 'edit',
        icon: 'edit',
        label: T('Edit'),
        onClick: (row: any) => {
          this.doEdit(row.id);
        },
      },
      {
        actionName: parentrow.description,
        id: 'delete',
        name: 'delete',
        label: T('Delete'),
        icon: 'delete',
        onClick: (row: any) => {
          this.entityList.doDelete(row);
        },
      },
    ];
  }

  isActionVisible(actionId: string, row: any): boolean {
    if (actionId === 'run_now' && row.job && row.job.state === EntityJobState.Running) {
      return false;
    }
    if (actionId === 'stop' && (row.job ? row.job && row.job.state !== EntityJobState.Running : true)) {
      return false;
    }
    return true;
  }

  onButtonClick(row: any): void {
    this.stateButton(row);
  }

  stateButton(row: any): void {
    if (row.job) {
      if (row.state.state === EntityJobState.Running) {
        this.entityList.runningStateButton(row.job.id);
      } else {
        this.job.showLogs(row.job);
      }
    } else {
      this.dialog.Info(globalHelptext.noLogDilaog.title, globalHelptext.noLogDilaog.message);
    }
  }

  doAdd(id?: number): void {
    this.modalService.open(
      'slide-in-form',
      new CloudsyncFormComponent(
        this.router,
        this.aroute,
        this.loader,
        this.dialog,
        this.matDialog,
        this.ws,
        this.cloudCredentialService,
        this.job,
        this.modalService,
      ),
      id,
    );
  }

  doEdit(id: number): void {
    this.doAdd(id);
  }

  ngOnDestroy(): void {
    this.onModalClose?.unsubscribe();
  }
}
