using System;
using System.Runtime.ExceptionServices;
using System.Threading;

namespace VRCX.Tests;

internal static class StaTest
{
    internal static void Run(Action action)
    {
        ExceptionDispatchInfo failure = null;
        using var completed = new ManualResetEventSlim(false);
        var thread = new Thread(() =>
        {
            try
            {
                action();
            }
            catch (Exception exception)
            {
                failure = ExceptionDispatchInfo.Capture(exception);
            }
            finally
            {
                completed.Set();
            }
        });

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        completed.Wait();
        thread.Join();
        failure?.Throw();
    }
}
