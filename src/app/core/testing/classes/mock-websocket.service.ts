import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { when } from 'jest-when';
import { Observable, of, Subject } from 'rxjs';
import { ValuesType } from 'utility-types';
import {
  CallResponseOrFactory,
  JobResponseOrFactory,
} from 'app/core/testing/interfaces/mock-websocket-responses.interface';
import { ApiCallDirectory, ApiCallMethod, ApiCallParams } from 'app/interfaces/api/api-call-directory.interface';
import { ApiEventDirectory } from 'app/interfaces/api/api-event-directory.interface';
import { ApiJobDirectory, ApiJobMethod, ApiJobParams } from 'app/interfaces/api/api-job-directory.interface';
import { ApiEvent } from 'app/interfaces/api-message.interface';
import { Job } from 'app/interfaces/job.interface';
import { WebSocketConnectionService } from 'app/services/websocket-connection.service';
import { WebSocketService } from 'app/services/ws.service';

/**
 * Better than just expect.anything() because it allows null and undefined.
 */
const anyArgument = when((_: unknown) => true);

/**
 * MockWebSocketService can be used to update websocket mocks on the fly.
 * For initial setup prefer mockWebSocket();
 *
 * To update on the fly:
 * @example
 * ```
 * // In test case:
 * const websocketService = spectator.inject(MockWebSocketService);
 * websocketService.mockCallOnce('filesystem.stat', { gid: 5 } as FileSystemStat);
 * ```
 */
@Injectable()
export class MockWebSocketService extends WebSocketService {
  private subscribeStream$ = new Subject<ApiEvent>();
  private jobIdCounter = 1;

  constructor(
    protected router: Router,
    protected wsManager: WebSocketConnectionService,
    protected translate: TranslateService,
  ) {
    super(router, wsManager, translate);

    this.call = jest.fn();
    this.job = jest.fn();
    this.startJob = jest.fn();
    this.subscribe = jest.fn(() => this.subscribeStream$.asObservable() as Observable<ApiEvent<ValuesType<ApiEventDirectory>['response']>>);

    when(this.call).mockImplementation((method: ApiCallMethod, args: unknown) => {
      throw Error(`Unmocked websocket call ${method} with ${JSON.stringify(args)}`);
    });
    when(this.job).mockImplementation((method: ApiJobMethod, args: unknown) => {
      throw Error(`Unmocked websocket job call ${method} with ${JSON.stringify(args)}`);
    });
  }

  mockCall<K extends ApiCallMethod>(method: K, response: CallResponseOrFactory<K>): void {
    const mockedImplementation = (_: K, params: ApiCallParams<K>): Observable<unknown> => {
      if (response instanceof Function) {
        return of(response(params));
      }

      return of(response);
    };

    when(this.call).calledWith(method).mockImplementation(mockedImplementation);
    when(this.call)
      .calledWith(method, anyArgument as unknown as ApiCallParams<ApiCallMethod>)
      .mockImplementation(mockedImplementation);
  }

  mockCallOnce<K extends ApiCallMethod>(method: K, response: ApiCallDirectory[K]['response']): void {
    when(this.call)
      .calledWith(method, anyArgument as unknown as ApiCallParams<ApiCallMethod>)
      .mockReturnValueOnce(of(response));
  }
  mockJob<K extends ApiJobMethod>(method: K, response: JobResponseOrFactory<K>): void {
    const getJobResponse = (params: ApiJobParams<K> = undefined): Job<ApiJobDirectory[K]['response']> => {
      let job: Job;
      if (response instanceof Function) {
        job = response(params);
      } else {
        job = response;
      }

      return {
        ...job,
        id: this.jobIdCounter,
      } as Job<ApiJobDirectory[K]['response']>;
    };
    when(this.startJob).calledWith(method).mockReturnValue(of(this.jobIdCounter));
    when(this.startJob).calledWith(method, anyArgument).mockReturnValue(of(this.jobIdCounter));
    when(this.job).calledWith(method).mockImplementation(() => of(getJobResponse()));
    when(this.job).calledWith(method, anyArgument)
      .mockImplementation((_, params) => of(getJobResponse(params)));
    when(this.call)
      .calledWith('core.get_jobs', [[['id', '=', this.jobIdCounter]]])
      .mockImplementation(() => of([getJobResponse()]));

    this.jobIdCounter += 1;
  }

  emitSubscribeEvent(event: ApiEvent): void {
    this.subscribeStream$.next(event);
  }
}
