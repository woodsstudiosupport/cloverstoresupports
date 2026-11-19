package com.woodsstudio.clover.apps;
import android.content.*;
import android.content.pm.PackageInstaller;
import android.widget.Toast;
public final class InstallReceiver extends BroadcastReceiver{
 @Override public void onReceive(Context context,Intent intent){
  int status=intent.getIntExtra(PackageInstaller.EXTRA_STATUS,PackageInstaller.STATUS_FAILURE);
  long download=intent.getLongExtra("download",-1);
  String result;
  if(status==PackageInstaller.STATUS_PENDING_USER_ACTION){
   Intent confirmation=intent.getParcelableExtra(Intent.EXTRA_INTENT);
   if(confirmation!=null){confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(confirmation);}
   result="Waiting for your installation confirmation";
  }else if(status==PackageInstaller.STATUS_SUCCESS)result="Installed successfully";
  else if(status==PackageInstaller.STATUS_FAILURE_ABORTED)result="Installation cancelled";
  else result="Installation failed: "+intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
  context.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putString("install:"+download,result).apply();
  if(status!=PackageInstaller.STATUS_PENDING_USER_ACTION)Toast.makeText(context,result,Toast.LENGTH_LONG).show();
 }
}
