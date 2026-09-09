using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using NLog;
using Valve.VR;

namespace VRCX
{
    public class VRCXVRElectron : VRCXVRInterface
    {
        public static VRCXVRInterface Instance;
        private static readonly Logger logger = LogManager.GetCurrentClassLogger();
        private static readonly float[] _rotation = { 0f, 0f, 0f };
        private static readonly float[] _translation = { 0f, 0f, 0f };
        private static readonly float[] _translationLeft = { -7f / 100f, -5f / 100f, 6f / 100f };
        private static readonly float[] _translationRight = { 7f / 100f, -5f / 100f, 6f / 100f };
        private static readonly float[] _rotationLeft = { 90f * (float)(Math.PI / 180f), 90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f) };
        private static readonly float[] _rotationRight = { -90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f), -90f * (float)(Math.PI / 180f) };
        private readonly List<string[]> _deviceList;
        private readonly ReaderWriterLockSlim _deviceListLock;
        private bool _active;
        private bool _isOverlayStarted;
        private bool _menuButton;
        private int _overlayHand;
        private GLTextureWriter _overlayTextureWriter;
        private Thread _thread;
        private DateTime _nextOverlayUpdate;

        private ulong _hmdOverlayHandle;
        private bool _hmdOverlayActive;
        private bool _hmdOverlayWasActive;

        private ulong _wristOverlayHandle;
        private ulong _wristOverlayMouseScaleHandle;
        private bool _wristOverlayActive;
        private bool _wristOverlayWasActive;
        private readonly object _wristPointerLock = new();
        private string _latestWristPointerMovePayload;
        private string _latestWristPointerClickPayload;
        private bool _hasWristPointerMove;
        private bool _hasWristPointerClick;
        private bool _wristPointerTriggerWasPressed;
        private bool _hasLastWristPointerPoint;
        private float _lastWristPointerX = 0.5f;
        private float _lastWristPointerY = 0.5f;
        private DateTime _lastWristPointerHitAt = DateTime.MinValue;
        private ETrackedControllerRole _wristControllerRole = ETrackedControllerRole.Invalid;
        private WristPointerCoordinateSpace _wristPointerCoordinateSpace = WristPointerCoordinateSpace.Unknown;
        private readonly WristPointerPoseResolver _wristPointerPoseResolver = new();

        private const string OVERLAY_SHM_PATH = "/dev/shm/vrcx_overlay";
        private const int WRIST_FRAME_WIDTH = 512;
        private const int WRIST_FRAME_HEIGHT = 512;
        private const int WRIST_FRAME_SIZE = WRIST_FRAME_WIDTH * WRIST_FRAME_HEIGHT * 4; // RGBA
        private const int HMD_FRAME_WIDTH = 1024;
        private const int HMD_FRAME_HEIGHT = 1024;
        private const int HMD_FRAME_SIZE = HMD_FRAME_WIDTH * HMD_FRAME_HEIGHT * 4; // RGBA

        private const int SHARED_FRAME_SIZE = SHARED_FRAME_WIDTH * SHARED_FRAME_HEIGHT * 4;
        private const int SHARED_FRAME_WIDTH = 1024;
        private const int SHARED_FRAME_HEIGHT = WRIST_FRAME_HEIGHT + HMD_FRAME_HEIGHT;
        private const float WRIST_TEXTURE_U_MIN = 0f;
        private const float WRIST_TEXTURE_U_MAX = 0.5f;
        private const float WRIST_TEXTURE_V_MIN = 0f;
        private const float WRIST_TEXTURE_V_MAX = (float)WRIST_FRAME_HEIGHT / SHARED_FRAME_HEIGHT;
        private const double WRIST_POINTER_MISS_GRACE_MILLISECONDS = 100d;
        private byte[] frameBuffer = new byte[SHARED_FRAME_SIZE];

        private MemoryMappedFile _overlayMMF;
        private MemoryMappedViewAccessor _overlayAccessor;
        private readonly ConcurrentQueue<KeyValuePair<string, string>> _overlayFunctionQueue = new ConcurrentQueue<KeyValuePair<string, string>>();

        static VRCXVRElectron()
        {
            Instance = new VRCXVRElectron();
        }

        public VRCXVRElectron()
        {
            _deviceListLock = new ReaderWriterLockSlim();
            _deviceList = new List<string[]>();
            _thread = new Thread(ThreadLoop)
            {
                IsBackground = true
            };
        }

        // NOTE
        // 메모리 릭 때문에 미리 생성해놓고 계속 사용함
        public override void Init()
        {
            _thread.Start();
        }

        public override void Exit()
        {
            var thread = _thread;
            _thread = null;
            thread?.Interrupt();
            thread?.Join();

            _overlayAccessor?.Dispose();
            _overlayAccessor = null;
            _overlayMMF?.Dispose();
            _overlayMMF = null;

            GLContextX11.Cleanup();
            GLContextWayland.Cleanup();
        }

        public override void Restart()
        {
            Exit();
            Instance = new VRCXVRElectron();
            Instance.Init();
            Program.VRCXVRInstance = Instance;
            //MainForm.Instance.Browser.ExecuteScriptAsync("console.log('VRCXVR Restarted');");
        }

        private void SetupTextures()
        {
            bool contextInitialised = false;

            // Check if we're running on Wayland
            if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY")) ||
                Environment.GetEnvironmentVariable("XDG_SESSION_TYPE")?.ToLower() == "wayland")
            {
                contextInitialised = GLContextWayland.Initialise();
            }
            else
            {
                contextInitialised = GLContextX11.Initialise();
            }

            if (!contextInitialised)
            {
                contextInitialised = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY")) ?
                    GLContextX11.Initialise() : GLContextWayland.Initialise();
            }

            if (!contextInitialised)
            {
                throw new Exception("Failed to initialise OpenGL context");
            }

            _overlayTextureWriter = new GLTextureWriter(SHARED_FRAME_WIDTH, SHARED_FRAME_HEIGHT);
            _overlayTextureWriter.UpdateTexture();
        }

        private void UpgradeDevice()
        {

        }

        public byte[] GetLatestOverlayFrame()
        {
            if (_overlayAccessor == null) return null;
            byte ready = _overlayAccessor.ReadByte(0);
            if (ready == 1)
            {
                _overlayAccessor.ReadArray(1, frameBuffer, 0, SHARED_FRAME_SIZE);
                _overlayAccessor.Write(0, (byte)0); // reset flag
                return frameBuffer;
            }
            return null;
        }

        private static void FlipImageVertically(ref byte[] imageData, int width, int height)
        {
            int stride = width * 4; // 4 bytes per pixel (RGBA)
            byte[] tempRow = new byte[stride];

            for (int y = 0; y < height / 2; y++)
            {
                int topIndex = y * stride;
                int bottomIndex = (height - 1 - y) * stride;

                // Swap rows
                Buffer.BlockCopy(imageData, topIndex, tempRow, 0, stride);
                Buffer.BlockCopy(imageData, bottomIndex, imageData, topIndex, stride);
                Buffer.BlockCopy(tempRow, 0, imageData, bottomIndex, stride);
            }
        }

        private void ThreadLoop()
        {
            var active = false;
            var e = new VREvent_t();
            var nextInit = DateTime.MinValue;
            var nextDeviceUpdate = DateTime.MinValue;
            var nextWristPointerUpdate = DateTime.MinValue;
            _nextOverlayUpdate = DateTime.MinValue;
            var overlayIndex = OpenVR.k_unTrackedDeviceIndexInvalid;
            var overlayVisible1 = false;
            var overlayVisible2 = false;
            var dashboardHandle = 0UL;

            while (_thread != null)
            {
                try
                {
                    if (_active)
                        Thread.Sleep(1);
                    else
                        Thread.Sleep(32);
                }
                catch (ThreadInterruptedException)
                {
                }

                if (_active)
                {
                    var system = OpenVR.System;
                    if (system == null)
                    {
                        if (DateTime.UtcNow.CompareTo(nextInit) <= 0)
                        {
                            continue;
                        }

                        var _err = EVRInitError.None;
                        system = OpenVR.Init(ref _err, EVRApplicationType.VRApplication_Background);
                        nextInit = DateTime.UtcNow.AddSeconds(5);
                        if (system == null)
                        {
                            continue;
                        }

                        active = true;
                        SetupTextures();
                        _isOverlayStarted = true;
                    }

                    while (system.PollNextEvent(ref e, (uint)Marshal.SizeOf(e)))
                    {
                        var type = (EVREventType)e.eventType;
                        if (type == EVREventType.VREvent_Quit)
                        {
                            _isOverlayStarted = false;
                            active = false;
                            IsHmdAfk = false;
                            OpenVR.Shutdown();
                            nextInit = DateTime.UtcNow.AddSeconds(10);
                            system = null;

                            _wristOverlayHandle = 0;
                            _hmdOverlayHandle = 0;
                            break;
                        }
                    }

                    if (system != null)
                    {
                        if (DateTime.UtcNow.CompareTo(nextDeviceUpdate) >= 0)
                        {
                            overlayIndex = OpenVR.k_unTrackedDeviceIndexInvalid;
                            UpdateDevices(system, ref overlayIndex);
                            if (overlayIndex != OpenVR.k_unTrackedDeviceIndexInvalid)
                            {
                                _nextOverlayUpdate = DateTime.UtcNow.AddSeconds(10);
                            }

                            nextDeviceUpdate = DateTime.UtcNow.AddSeconds(0.1);
                        }

                        var overlay = OpenVR.Overlay;
                        if (overlay != null)
                        {
                            var dashboardVisible = overlay.IsDashboardVisible();
                            //var err = ProcessDashboard(overlay, ref dashboardHandle, dashboardVisible);
                            //if (err != EVROverlayError.None &&
                            //    dashboardHandle != 0)
                            //{
                            //    overlay.DestroyOverlay(dashboardHandle);
                            //    dashboardHandle = 0;
                            //    logger.Error(err);
                            //}

                            if (_wristOverlayActive)
                            {
                                var err = ProcessOverlay1(overlay, ref _wristOverlayHandle, ref overlayVisible1,
                                    dashboardVisible, overlayIndex);
                                if (err != EVROverlayError.None &&
                                    _wristOverlayHandle != 0)
                                {
                                    overlay.DestroyOverlay(_wristOverlayHandle);
                                    _wristOverlayHandle = 0;
                                    logger.Error(err);
                                }
                            }

                            if (_hmdOverlayActive)
                            {
                                var err = ProcessOverlay2(overlay, ref _hmdOverlayHandle, ref overlayVisible2,
                                    dashboardVisible);
                                if (err != EVROverlayError.None &&
                                    _hmdOverlayHandle != 0)
                                {
                                    overlay.DestroyOverlay(_hmdOverlayHandle);
                                    _hmdOverlayHandle = 0;
                                    logger.Error(err);
                                }
                            }

                            if (DateTime.UtcNow.CompareTo(nextWristPointerUpdate) >= 0)
                            {
                                UpdateWristPointer(system, overlay, _wristOverlayHandle, overlayVisible1);
                                nextWristPointerUpdate = DateTime.UtcNow.AddMilliseconds(16);
                            }
                        }
                    }
                }
                else if (active)
                {
                    active = false;
                    _isOverlayStarted = false;
                    IsHmdAfk = false;
                    OpenVR.Shutdown();
                    _deviceListLock.EnterWriteLock();
                    try
                    {
                        _deviceList.Clear();
                    }
                    finally
                    {
                        _deviceListLock.ExitWriteLock();
                    }
                }
            }

            _overlayAccessor?.Dispose();
            _overlayAccessor = null;
            _overlayMMF?.Dispose();
            _overlayMMF = null;

            GLContextX11.Cleanup();
            GLContextWayland.Cleanup();
        }

        public override void SetActive(bool active, bool hmdOverlay, bool wristOverlay, bool menuButton, int overlayHand)
        {
            _active = active;
            _hmdOverlayActive = hmdOverlay;
            _wristOverlayActive = wristOverlay;
            _menuButton = menuButton;
            _overlayHand = overlayHand;

            if (!_wristOverlayActive)
            {
                ResetWristPointerState();
            }

            if (_hmdOverlayActive != _hmdOverlayWasActive && _hmdOverlayHandle != 0)
            {
                OpenVR.Overlay.DestroyOverlay(_hmdOverlayHandle);
                _hmdOverlayHandle = 0;
            }
            _hmdOverlayWasActive = _hmdOverlayActive;

            if (_wristOverlayActive != _wristOverlayWasActive && _wristOverlayHandle != 0)
            {
                OpenVR.Overlay.DestroyOverlay(_wristOverlayHandle);
                _wristOverlayHandle = 0;
            }
            _wristOverlayWasActive = _wristOverlayActive;

            if (!_active || (!_hmdOverlayActive && !_wristOverlayActive))
            {
                _overlayAccessor?.Dispose();
                _overlayAccessor = null;
                _overlayMMF?.Dispose();
                _overlayMMF = null;
                GLContextX11.Cleanup();
                GLContextWayland.Cleanup();
            }
        }

        public override bool IsActive()
        {
            return _active;
        }

        public override void Refresh()
        {
            //_wristOverlay.Reload();
            //_hmdOverlay.Reload();
        }

        public override string[][] GetDevices()
        {
            _deviceListLock.EnterReadLock();
            try
            {
                return _deviceList.ToArray();
            }
            finally
            {
                _deviceListLock.ExitReadLock();
            }
        }

        private void UpdateDevices(CVRSystem system, ref uint overlayIndex)
        {
            _deviceListLock.EnterWriteLock();
            try
            {
                _deviceList.Clear();
            }
            finally
            {
                _deviceListLock.ExitWriteLock();
            }

            var sb = new StringBuilder(256);
            var state = new VRControllerState_t();
            var poses = new TrackedDevicePose_t[OpenVR.k_unMaxTrackedDeviceCount];
            system.GetDeviceToAbsoluteTrackingPose(ETrackingUniverseOrigin.TrackingUniverseStanding, 0, poses);
            for (var i = 0u; i < OpenVR.k_unMaxTrackedDeviceCount; ++i)
            {
                var devClass = system.GetTrackedDeviceClass(i);
                switch (devClass)
                {
                    case ETrackedDeviceClass.HMD:
                        var success = system.GetControllerState(i, ref state, (uint)Marshal.SizeOf(state));
                        if (!success)
                            break; // this fails while SteamVR overlay is open

                        // var prox = state.ulButtonPressed & (1UL << ((int)EVRButtonId.k_EButton_ProximitySensor));
                        // var isHmdAfk = prox == 0;

                        var headsetErr = ETrackedPropertyError.TrackedProp_Success;
                        var headsetBatteryPercentage = system.GetFloatTrackedDeviceProperty(i, ETrackedDeviceProperty.Prop_DeviceBatteryPercentage_Float, ref headsetErr);
                        if (headsetErr != ETrackedPropertyError.TrackedProp_Success)
                        {
                            // Headset has no battery, skip displaying it
                            break;
                        }

                        var headset = new[]
                        {
                            "headset",
                            system.IsTrackedDeviceConnected(i)
                                ? "connected"
                                : "disconnected",
                            // Currently neither VD or SteamLink report charging state
                            "discharging",
                            (headsetBatteryPercentage * 100).ToString(),
                            poses[i].eTrackingResult.ToString()
                        };
                        _deviceListLock.EnterWriteLock();
                        try
                        {
                            _deviceList.Add(headset);
                        }
                        finally
                        {
                            _deviceListLock.ExitWriteLock();
                        }

                        break;
                    case ETrackedDeviceClass.Controller:
                    case ETrackedDeviceClass.GenericTracker:
                    case ETrackedDeviceClass.TrackingReference:
                        {
                            var err = ETrackedPropertyError.TrackedProp_Success;
                            var batteryPercentage = system.GetFloatTrackedDeviceProperty(i, ETrackedDeviceProperty.Prop_DeviceBatteryPercentage_Float, ref err);
                            if (err != ETrackedPropertyError.TrackedProp_Success)
                            {
                                batteryPercentage = 1f;
                            }

                            err = ETrackedPropertyError.TrackedProp_Success;
                            var isCharging = system.GetBoolTrackedDeviceProperty(i, ETrackedDeviceProperty.Prop_DeviceIsCharging_Bool, ref err);
                            if (err != ETrackedPropertyError.TrackedProp_Success)
                            {
                                isCharging = false;
                            }

                            sb.Clear();
                            system.GetStringTrackedDeviceProperty(i, ETrackedDeviceProperty.Prop_TrackingSystemName_String, sb, (uint)sb.Capacity, ref err);
                            var isOculus = sb.ToString().IndexOf("oculus", StringComparison.OrdinalIgnoreCase) >= 0;
                            // Oculus : B/Y, Bit 1, Mask 2
                            // Oculus : A/X, Bit 7, Mask 128
                            // Vive : Menu, Bit 1, Mask 2,
                            // Vive : Grip, Bit 2, Mask 4
                            var role = system.GetControllerRoleForTrackedDeviceIndex(i);
                            if (role == ETrackedControllerRole.LeftHand || role == ETrackedControllerRole.RightHand)
                            {
                                if (_overlayHand == 0 ||
                                    (_overlayHand == 1 && role == ETrackedControllerRole.LeftHand) ||
                                    (_overlayHand == 2 && role == ETrackedControllerRole.RightHand))
                                {
                                    if (system.GetControllerState(i, ref state, (uint)Marshal.SizeOf(state)) &&
                                        (state.ulButtonPressed & (_menuButton ? 2u : isOculus ? 128u : 4u)) != 0)
                                    {
                                        _nextOverlayUpdate = DateTime.MinValue;
                                        if (role == ETrackedControllerRole.LeftHand)
                                        {
                                            Array.Copy(_translationLeft, _translation, 3);
                                            Array.Copy(_rotationLeft, _rotation, 3);
                                        }
                                        else
                                        {
                                            Array.Copy(_translationRight, _translation, 3);
                                            Array.Copy(_rotationRight, _rotation, 3);
                                        }

                                        _wristControllerRole = role;
                                        overlayIndex = i;
                                    }
                                }
                            }

                            var type = string.Empty;
                            if (devClass == ETrackedDeviceClass.Controller)
                            {
                                if (role == ETrackedControllerRole.LeftHand)
                                {
                                    type = "leftController";
                                }
                                else if (role == ETrackedControllerRole.RightHand)
                                {
                                    type = "rightController";
                                }
                                else
                                {
                                    type = "controller";
                                }
                            }
                            else if (devClass == ETrackedDeviceClass.GenericTracker)
                            {
                                type = "tracker";
                            }
                            else if (devClass == ETrackedDeviceClass.TrackingReference)
                            {
                                type = "base";
                            }

                            var item = new[]
                            {
                            type,
                            system.IsTrackedDeviceConnected(i)
                                ? "connected"
                                : "disconnected",
                            isCharging
                                ? "charging"
                                : "discharging",
                            (batteryPercentage * 100).ToString(),
                            poses[i].eTrackingResult.ToString()
                        };
                            _deviceListLock.EnterWriteLock();
                            try
                            {
                                _deviceList.Add(item);
                            }
                            finally
                            {
                                _deviceListLock.ExitWriteLock();
                            }

                            break;
                        }
                }
            }
        }

        private void UpdateWristPointer(CVRSystem system, CVROverlay overlay, ulong overlayHandle, bool overlayVisible)
        {
            if (!overlayVisible)
            {
                _hasLastWristPointerPoint = false;
            }

            var wristRole = _wristControllerRole;
            if (wristRole != ETrackedControllerRole.LeftHand && wristRole != ETrackedControllerRole.RightHand)
            {
                wristRole = _overlayHand == 2
                    ? ETrackedControllerRole.RightHand
                    : ETrackedControllerRole.LeftHand;
            }

            var pointerRole = wristRole == ETrackedControllerRole.LeftHand
                ? ETrackedControllerRole.RightHand
                : ETrackedControllerRole.LeftHand;
            var pointerHand = pointerRole == ETrackedControllerRole.RightHand ? "right" : "left";
            var poses = new TrackedDevicePose_t[OpenVR.k_unMaxTrackedDeviceCount];
            system.GetDeviceToAbsoluteTrackingPose(ETrackingUniverseOrigin.TrackingUniverseStanding, 0, poses);

            var triggerPressed = false;
            var hit = false;
            var currentHit = false;
            var x = 0.5f;
            var y = 0.5f;
            var state = new VRControllerState_t();
            for (var i = 0u; i < OpenVR.k_unMaxTrackedDeviceCount; ++i)
            {
                if (system.GetTrackedDeviceClass(i) != ETrackedDeviceClass.Controller ||
                    system.GetControllerRoleForTrackedDeviceIndex(i) != pointerRole)
                {
                    continue;
                }

                if (system.GetControllerState(i, ref state, (uint)Marshal.SizeOf(state)))
                {
                    triggerPressed = (state.ulButtonPressed & (1UL << (int)EVRButtonId.k_EButton_SteamVR_Trigger)) != 0 ||
                        state.rAxis1.x >= 0.5f;
                }

                var pose = poses[i];
                if (overlay != null && overlayHandle != 0 && overlayVisible && pose.bPoseIsValid)
                {
                    var devicePose = pose.mDeviceToAbsoluteTracking;
                    var hasTipPose = _wristPointerPoseResolver.TryGetTipPose(
                        system,
                        i,
                        pointerRole,
                        ref state,
                        out var tipPose
                    );
                    var deviceOrigin = new Vector3(devicePose.m3, devicePose.m7, devicePose.m11);
                    var deviceAxisX = new Vector3(devicePose.m0, devicePose.m4, devicePose.m8);
                    var deviceAxisY = new Vector3(devicePose.m1, devicePose.m5, devicePose.m9);
                    var deviceAxisZ = new Vector3(devicePose.m2, devicePose.m6, devicePose.m10);
                    var rayValid = hasTipPose
                        ? WristPointerMath.TryCreateTipRay(
                            deviceOrigin,
                            deviceAxisX,
                            deviceAxisY,
                            deviceAxisZ,
                            new Vector3(tipPose.m3, tipPose.m7, tipPose.m11),
                            new Vector3(tipPose.m0, tipPose.m4, tipPose.m8),
                            new Vector3(tipPose.m1, tipPose.m5, tipPose.m9),
                            new Vector3(tipPose.m2, tipPose.m6, tipPose.m10),
                            out var ray
                        )
                        : WristPointerMath.TryNormalizeRay(
                            deviceOrigin,
                            WristPointerMath.GetControllerForward(deviceAxisZ.X, deviceAxisZ.Y, deviceAxisZ.Z),
                            out ray
                        );
                    var preferredX = 0.5f;
                    var preferredY = 0.5f;
                    var preferredHit = rayValid && TryComputeOverlayPoint(
                        overlay,
                        overlayHandle,
                        ray,
                        WRIST_FRAME_WIDTH,
                        WRIST_FRAME_HEIGHT,
                        WRIST_TEXTURE_U_MIN,
                        WRIST_TEXTURE_U_MAX,
                        WRIST_TEXTURE_V_MIN,
                        WRIST_TEXTURE_V_MAX,
                        ref _wristPointerCoordinateSpace,
                        out preferredX,
                        out preferredY
                    );
                    var fallbackX = 0.5f;
                    var fallbackY = 0.5f;
                    var fallbackHit = false;
                    if (!preferredHit && hasTipPose &&
                        WristPointerMath.TryNormalizeRay(
                            deviceOrigin,
                            WristPointerMath.GetControllerForward(deviceAxisZ.X, deviceAxisZ.Y, deviceAxisZ.Z),
                            out var fallbackRay
                        ))
                    {
                        fallbackHit = TryComputeOverlayPoint(
                            overlay,
                            overlayHandle,
                            fallbackRay,
                            WRIST_FRAME_WIDTH,
                            WRIST_FRAME_HEIGHT,
                            WRIST_TEXTURE_U_MIN,
                            WRIST_TEXTURE_U_MAX,
                            WRIST_TEXTURE_V_MIN,
                            WRIST_TEXTURE_V_MAX,
                            ref _wristPointerCoordinateSpace,
                            out fallbackX,
                            out fallbackY
                        );
                    }

                    currentHit = WristPointerMath.TrySelectOverlayPoint(
                        preferredHit,
                        preferredX,
                        preferredY,
                        fallbackHit,
                        fallbackX,
                        fallbackY,
                        out x,
                        out y
                    );

                    if (currentHit)
                    {
                        _hasLastWristPointerPoint = true;
                        _lastWristPointerX = x;
                        _lastWristPointerY = y;
                        _lastWristPointerHitAt = DateTime.UtcNow;
                    }

                    hit = WristPointerMath.TryRetainOverlayPoint(
                        currentHit,
                        x,
                        y,
                        _hasLastWristPointerPoint,
                        _lastWristPointerX,
                        _lastWristPointerY,
                        _hasLastWristPointerPoint
                            ? (DateTime.UtcNow - _lastWristPointerHitAt).TotalMilliseconds
                            : double.PositiveInfinity,
                        WRIST_POINTER_MISS_GRACE_MILLISECONDS,
                        out x,
                        out y
                    );
                }

                break;
            }

            var visible = overlayVisible && hit;
            var pressed = visible && triggerPressed;
            PublishWristPointerMove(WristPointerMath.CreatePayload(x, y, visible, pressed, pointerHand));
            if (overlayVisible && currentHit && triggerPressed && !_wristPointerTriggerWasPressed)
            {
                PublishWristPointerClick(WristPointerMath.CreatePayload(x, y, true, true, pointerHand));
            }

            _wristPointerTriggerWasPressed = triggerPressed;
        }

        private static bool TryComputeOverlayPoint(
            CVROverlay overlay,
            ulong overlayHandle,
            WristPointerRay ray,
            int width,
            int height,
            float textureUMin,
            float textureUMax,
            float textureVMin,
            float textureVMax,
            ref WristPointerCoordinateSpace coordinateSpace,
            out float x,
            out float y
        )
        {
            x = 0.5f;
            y = 0.5f;
            var intersectionParams = new VROverlayIntersectionParams_t
            {
                vSource = new HmdVector3_t
                {
                    v0 = ray.Source.X,
                    v1 = ray.Source.Y,
                    v2 = ray.Source.Z
                },
                vDirection = new HmdVector3_t
                {
                    v0 = ray.Direction.X,
                    v1 = ray.Direction.Y,
                    v2 = ray.Direction.Z
                },
                eOrigin = ETrackingUniverseOrigin.TrackingUniverseStanding
            };
            var intersectionResults = new VROverlayIntersectionResults_t();
            return overlay.ComputeOverlayIntersection(overlayHandle, ref intersectionParams, ref intersectionResults) &&
                WristPointerMath.TryConvertOverlayCoordinates(
                    intersectionResults.vUVs.v0,
                    intersectionResults.vUVs.v1,
                    width,
                    height,
                    textureUMin,
                    textureUMax,
                    textureVMin,
                    textureVMax,
                    ref coordinateSpace,
                    out x,
                    out y
                );
        }

        private void PublishWristPointerMove(string payload)
        {
            lock (_wristPointerLock)
            {
                if (_hasWristPointerMove && _latestWristPointerMovePayload == payload)
                {
                    return;
                }

                _latestWristPointerMovePayload = payload;
                _hasWristPointerMove = true;
            }
        }

        private void PublishWristPointerClick(string payload)
        {
            lock (_wristPointerLock)
            {
                _latestWristPointerClickPayload = payload;
                _hasWristPointerClick = true;
            }
        }

        internal List<KeyValuePair<string, string>> GetWristPointerQueue()
        {
            lock (_wristPointerLock)
            {
                var result = new List<KeyValuePair<string, string>>();
                if (_hasWristPointerMove)
                {
                    result.Add(new KeyValuePair<string, string>("wristPointerMove", _latestWristPointerMovePayload));
                    _hasWristPointerMove = false;
                }

                if (_hasWristPointerClick)
                {
                    result.Add(new KeyValuePair<string, string>("wristPointerClick", _latestWristPointerClickPayload));
                    _hasWristPointerClick = false;
                }

                return result;
            }
        }

        private void ResetWristPointerState()
        {
            lock (_wristPointerLock)
            {
                _latestWristPointerMovePayload = null;
                _latestWristPointerClickPayload = null;
                _hasWristPointerMove = false;
                _hasWristPointerClick = false;
            }

            _wristPointerTriggerWasPressed = false;
            _hasLastWristPointerPoint = false;
            _lastWristPointerX = 0.5f;
            _lastWristPointerY = 0.5f;
            _lastWristPointerHitAt = DateTime.MinValue;
            _wristControllerRole = ETrackedControllerRole.Invalid;
            _wristPointerCoordinateSpace = WristPointerCoordinateSpace.Unknown;
            _wristOverlayMouseScaleHandle = 0;
            _wristPointerPoseResolver.Reset();
        }

        internal EVROverlayError ProcessDashboard(CVROverlay overlay, ref ulong dashboardHandle, bool dashboardVisible)
        {
            var err = EVROverlayError.None;

            if (dashboardHandle == 0)
            {
                err = overlay.FindOverlay("VRCX", ref dashboardHandle);
                if (err != EVROverlayError.None)
                {
                    if (err != EVROverlayError.UnknownOverlay)
                    {
                        return err;
                    }

                    ulong thumbnailHandle = 0;
                    err = overlay.CreateDashboardOverlay("VRCX", "VRCX", ref dashboardHandle, ref thumbnailHandle);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    var iconPath = Path.Join(Program.BaseDirectory, "VRCX.png");
                    err = overlay.SetOverlayFromFile(thumbnailHandle, iconPath);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    err = overlay.SetOverlayWidthInMeters(dashboardHandle, 1.5f);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    err = overlay.SetOverlayInputMethod(dashboardHandle, VROverlayInputMethod.Mouse);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }
                }
            }

            if (dashboardVisible)
            {
                //var texture = new Texture_t
                //{
                //    handle = _texture1.NativePointer
                //};
                //err = overlay.SetOverlayTexture(dashboardHandle, ref texture);
                //if (err != EVROverlayError.None)
                //{
                //    return err;
                //}
            }

            return err;
        }

        internal EVROverlayError ProcessOverlay1(CVROverlay overlay, ref ulong overlayHandle, ref bool overlayVisible, bool dashboardVisible, uint overlayIndex)
        {
            var err = EVROverlayError.None;

            if (overlayHandle == 0)
            {
                err = overlay.FindOverlay("VRCX1", ref overlayHandle);
                if (err != EVROverlayError.None)
                {
                    if (err != EVROverlayError.UnknownOverlay)
                    {
                        return err;
                    }

                    overlayVisible = false;
                    err = overlay.CreateOverlay("VRCX1", "VRCX1", ref overlayHandle);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    err = overlay.SetOverlayAlpha(overlayHandle, 0.9f);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    err = overlay.SetOverlayWidthInMeters(overlayHandle, 1f);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    err = overlay.SetOverlayInputMethod(overlayHandle, VROverlayInputMethod.None);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    _overlayMMF = MemoryMappedFile.CreateFromFile(OVERLAY_SHM_PATH, FileMode.Open, null, SHARED_FRAME_SIZE + 1);
                    _overlayAccessor = _overlayMMF.CreateViewAccessor();
                }
            }

            if (_wristOverlayMouseScaleHandle != overlayHandle)
            {
                var mouseScale = new HmdVector2_t
                {
                    v0 = WRIST_FRAME_WIDTH,
                    v1 = WRIST_FRAME_HEIGHT
                };
                err = overlay.SetOverlayMouseScale(overlayHandle, ref mouseScale);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                _wristOverlayMouseScaleHandle = overlayHandle;
            }

            if (overlayIndex != OpenVR.k_unTrackedDeviceIndexInvalid)
            {
                // http://www.opengl-tutorial.org/beginners-tutorials/tutorial-3-matrices
                // Scaling-Rotation-Translation
                var m = Matrix4x4.CreateScale(0.25f);
                m *= Matrix4x4.CreateRotationX(_rotation[0]);
                m *= Matrix4x4.CreateRotationY(_rotation[1]);
                m *= Matrix4x4.CreateRotationZ(_rotation[2]);
                m *= Matrix4x4.CreateTranslation(new Vector3(_translation[0], _translation[1], _translation[2]));
                var hm34 = new HmdMatrix34_t
                {
                    m0 = m.M11,
                    m1 = m.M21,
                    m2 = m.M31,
                    m3 = m.M41,
                    m4 = m.M12,
                    m5 = m.M22,
                    m6 = m.M32,
                    m7 = m.M42,
                    m8 = m.M13,
                    m9 = m.M23,
                    m10 = m.M33,
                    m11 = m.M43
                };
                err = overlay.SetOverlayTransformTrackedDeviceRelative(overlayHandle, overlayIndex, ref hm34);
                if (err != EVROverlayError.None)
                {
                    return err;
                }
            }

            if (!dashboardVisible &&
                DateTime.UtcNow.CompareTo(_nextOverlayUpdate) <= 0)
            {
                if (_overlayTextureWriter != null)
                {
                    byte[] imageData = GetLatestOverlayFrame();
                    if (imageData != null)
                    {
                        FlipImageVertically(ref imageData, SHARED_FRAME_WIDTH, SHARED_FRAME_HEIGHT);
                        _overlayTextureWriter.WriteImageToBuffer(imageData);
                        _overlayTextureWriter.UpdateTexture();

                        Texture_t texture = _overlayTextureWriter.AsTextureT();
                        var bounds = new VRTextureBounds_t
                        {
                            uMin = 0f,
                            uMax = 0.5f,
                            vMin = 0f,
                            vMax = (float)WRIST_FRAME_HEIGHT / SHARED_FRAME_HEIGHT
                        };
                        overlay.SetOverlayTextureBounds(overlayHandle, ref bounds);
                        err = OpenVR.Overlay.SetOverlayTexture(overlayHandle, ref texture);
                        if (err != EVROverlayError.None)
                        {
                            return err;
                        }

                        if (!overlayVisible)
                        {
                            err = overlay.ShowOverlay(overlayHandle);
                            if (err != EVROverlayError.None)
                            {
                                return err;
                            }

                            overlayVisible = true;
                        }
                    }
                }
            }
            else if (overlayVisible)
            {
                err = overlay.HideOverlay(overlayHandle);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                overlayVisible = false;
            }

            return err;
        }

        internal EVROverlayError ProcessOverlay2(CVROverlay overlay, ref ulong overlayHandle, ref bool overlayVisible, bool dashboardVisible)
        {
            var err = EVROverlayError.None;

            if (overlayHandle == 0)
            {
                err = overlay.FindOverlay("VRCX2", ref overlayHandle);
                if (err != EVROverlayError.None)
                {
                    if (err != EVROverlayError.UnknownOverlay)
                    {
                        return err;
                    }

                    overlayVisible = false;
                    err = overlay.CreateOverlay("VRCX2", "VRCX2", ref overlayHandle);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    err = overlay.SetOverlayAlpha(overlayHandle, 0.9f);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    err = overlay.SetOverlayWidthInMeters(overlayHandle, 1f);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    err = overlay.SetOverlayInputMethod(overlayHandle, VROverlayInputMethod.None);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    var m = Matrix4x4.CreateScale(1f);
                    m *= Matrix4x4.CreateTranslation(0, -0.3f, -1.5f);
                    var hm34 = new HmdMatrix34_t
                    {
                        m0 = m.M11,
                        m1 = m.M21,
                        m2 = m.M31,
                        m3 = m.M41,
                        m4 = m.M12,
                        m5 = m.M22,
                        m6 = m.M32,
                        m7 = m.M42,
                        m8 = m.M13,
                        m9 = m.M23,
                        m10 = m.M33,
                        m11 = m.M43
                    };
                    err = overlay.SetOverlayTransformTrackedDeviceRelative(overlayHandle, OpenVR.k_unTrackedDeviceIndex_Hmd, ref hm34);
                    if (err != EVROverlayError.None)
                    {
                        return err;
                    }

                    _overlayMMF = MemoryMappedFile.CreateFromFile(OVERLAY_SHM_PATH, FileMode.Open, null, SHARED_FRAME_SIZE + 1);
                    _overlayAccessor = _overlayMMF.CreateViewAccessor();
                }
            }

            if (!dashboardVisible)
            {
                if (_overlayTextureWriter != null)
                {
                    byte[] imageData = GetLatestOverlayFrame();
                    if (imageData != null)
                    {
                        FlipImageVertically(ref imageData, SHARED_FRAME_WIDTH, SHARED_FRAME_HEIGHT);
                        _overlayTextureWriter.WriteImageToBuffer(imageData);
                        _overlayTextureWriter.UpdateTexture();

                        Texture_t texture = _overlayTextureWriter.AsTextureT();
                        var bounds = new VRTextureBounds_t
                        {
                            uMin = 0f,
                            uMax = 1f,
                            vMin = (float)(SHARED_FRAME_HEIGHT - HMD_FRAME_HEIGHT) / SHARED_FRAME_HEIGHT,
                            vMax = 1f
                        };
                        overlay.SetOverlayTextureBounds(overlayHandle, ref bounds);
                        err = OpenVR.Overlay.SetOverlayTexture(overlayHandle, ref texture);
                        if (err != EVROverlayError.None)
                        {
                            return err;
                        }

                        if (!overlayVisible)
                        {
                            err = overlay.ShowOverlay(overlayHandle);
                            if (err != EVROverlayError.None)
                            {
                                return err;
                            }

                            overlayVisible = true;
                        }
                    }
                }
            }
            else if (overlayVisible)
            {
                err = overlay.HideOverlay(overlayHandle);
                if (err != EVROverlayError.None)
                {
                    return err;
                }

                overlayVisible = false;
            }

            return err;
        }

        public override ConcurrentQueue<KeyValuePair<string, string>> GetExecuteVrOverlayFunctionQueue()
        {
            return _overlayFunctionQueue;
        }

        public override void ExecuteVrOverlayFunction(string function, string json)
        {
            if (!_isOverlayStarted)
            {
                _overlayFunctionQueue.Clear();
                return;
            }

            _overlayFunctionQueue.Enqueue(new KeyValuePair<string, string>(function, json));
        }
    }
}
