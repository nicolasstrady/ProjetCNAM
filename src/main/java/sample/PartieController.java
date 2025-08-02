package sample;

import client.SocketClient;
import client.ServerListener;
import java.io.IOException;
import java.io.InputStream;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.scene.layout.FlowPane;

import java.util.ArrayList;
import java.util.List;

public class PartieController {

    @FXML
    private FlowPane main;
    @FXML
    private Button play;
    @FXML
    private Button take;
    @FXML
    private Button refuse;
    @FXML
    private HBox boxRois;
    @FXML
    private HBox boxChien;
    @FXML
    private HBox boxTour;
    @FXML
    private Button launch;
    @FXML
    private Button playTour;
    @FXML
    private Button endTour;
    @FXML
    private ImageView carteCenter;
    @FXML
    private ImageView dog;
    @FXML
    private Label statusLabel;

    private ServerListener listener;

    public void initHand(ArrayList<String> ids, ArrayList<String> liens) {
        main.setHgap(10);
        main.setVgap(10);
        for (int i = 0; i < ids.size(); i++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + liens.get(i));
            Image img = is != null ? new Image(is,60,100,false,false)
                                   : new Image(getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
            ImageView imageCarte = new ImageView(img);
            imageCarte.setId(ids.get(i));
            main.getChildren().add(imageCarte);
        }
    }

    public void startListener() {
        try {
            listener = new ServerListener(ConnexionController.host, ConnexionController.port, data -> {
                if (data.isEmpty()) return;
                String type = data.get(0).toString();
                switch (type) {
                    case "ANSWER_UPDATE":
                        handleAnswerUpdate(data.subList(1, data.size()));
                        break;
                    case "CALL_INFO":
                        handleCallInfo(data.subList(1, data.size()));
                        break;
                    case "DOG_READY":
                        playTour.setVisible(true);
                        break;
                    case "TOUR_UPDATE":
                        handleTourUpdate(data.subList(1, data.size()));
                        break;
                    default:
                        break;
                }
            });
            Thread t = new Thread(listener);
            t.setDaemon(true);
            t.start();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void handleAnswerUpdate(List<Object> resp) {
        int current = (int) resp.get(0);
        String takeFlag = (String) resp.get(1);
        int numPlayerTake = (int) resp.get(2);
        if (takeFlag.equals("TAKE")) {
            statusLabel.setText("Joueur " + numPlayerTake + " a pris le chien");
            take(numPlayerTake);
        } else if (current == Integer.parseInt(AccueilController.numJoueur)) {
            statusLabel.setText("A votre tour !");
            take.setVisible(true);
            refuse.setVisible(true);
        } else {
            statusLabel.setText("Au tour du Joueur " + current);
        }
    }

    private void handleCallInfo(List<Object> resp) {
        statusLabel.setText("Le Roi de " + resp.get(3) + " a été appelé !");
        ArrayList<Integer> idCartes = (ArrayList<Integer>) resp.get(1);
        ArrayList<String> lienCartes = (ArrayList<String>) resp.get(2);
        for (int i = 0; i < idCartes.size(); i++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
            Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
            ImageView imageChien = new ImageView(img);
            boxChien.getChildren().add(imageChien);
        }
        carteCenter.setVisible(false);
        launch.setVisible(true);
    }

    private void handleTourUpdate(List<Object> resp) {
        int current = (int) resp.get(0);
        boolean finTour = (boolean) resp.get(1);
        boolean finPartie = (boolean) resp.get(2);
        ArrayList<String> idCartes = (ArrayList<String>) resp.get(3);
        ArrayList<String> lienCartes = (ArrayList<String>) resp.get(4);
        if (current == Integer.parseInt(AccueilController.numJoueur) && !finTour && !finPartie) {
            statusLabel.setText("A votre tour !");
            boxTour.getChildren().clear();
            for (int i = 0; i < idCartes.size(); i++) {
                InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
                Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
                boxTour.getChildren().add(new ImageView(img));
            }
        } else if (finTour && !finPartie) {
            statusLabel.setText("Le tour est fini !");
            playTour.setVisible(true);
        } else if (finPartie) {
            statusLabel.setText("La partie est finie !");
        } else {
            statusLabel.setText("Au tour du Joueur " + current);
        }
    }

    public void play() {
        ArrayList<Object> waitsAnswer = new ArrayList<>();
        waitsAnswer.add("WAITANSWER");
        try {
            ArrayList<Object> resp = ConnexionController.client.send(waitsAnswer);
            handleAnswerUpdate(resp);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        play.setVisible(false);
    }

    public void playWithDog() throws InterruptedException {
        ArrayList<Object> chiens = new ArrayList<>();
        chiens.add("CHIEN");
        chiens.add(ConnexionController.idUser);

        try {
            ConnexionController.client.send(chiens);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        refuse.setVisible(false);
        take.setVisible(false);
        play();
    }

    public void playWithoutDog() throws InterruptedException {
        ArrayList<Object> refuses = new ArrayList<>();
        refuses.add("REFUSE");
        refuses.add(ConnexionController.idUser);

        try {
            ConnexionController.client.send(refuses);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        refuse.setVisible(false);
        take.setVisible(false);
        play();
    }

    public void take(int numPlayerTake) {
        if(numPlayerTake == Integer.parseInt(AccueilController.numJoueur)){
            carteCenter.setVisible(false);
            ArrayList<Object> rois = new ArrayList<>();
            rois.add("ROIS");
            rois.add(ConnexionController.idUser);
            ArrayList<Object> datas = null;
            try {
                datas = ConnexionController.client.send(rois);
            } catch (IOException | ClassNotFoundException e) {
                e.printStackTrace();
            }
            ArrayList<String> idCartes = (ArrayList<String>) datas.get(0);
            ArrayList<String> lienCartes = (ArrayList<String>) datas.get(1);
            boxRois.setSpacing(20);
            for(int i = 0; i < idCartes.size() ; i++) {
                    InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartes.get(i));
                    Image img = is != null ? new Image(is,60,100,false,false)
                                         : new Image(getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
                    ImageView imageRoi = new ImageView(img);
                    int finalI = i;
                    imageRoi.addEventHandler(javafx.scene.input.MouseEvent.MOUSE_CLICKED, event -> {
                        callKing(idCartes.get(finalI));
                    });
                    boxRois.getChildren().add(imageRoi);
            }
        } else {
            ArrayList<Object> waitcalls = new ArrayList<>();
            waitcalls.add("WAITCALL");
            waitcalls.add(ConnexionController.idUser);
            try {
                ArrayList<Object> resp = ConnexionController.client.send(waitcalls);
                if ((boolean) resp.get(0)) {
                    handleCallInfo(resp);
                }
            } catch (IOException | ClassNotFoundException e) {
                e.printStackTrace();
            }
        }
    }
    public void callKing(String idCarte) {
        boxRois.getChildren().clear();
        boxRois.setSpacing(20);
        boxChien.setSpacing(20);
        ArrayList<Object> calls = new ArrayList<>();
        calls.add("CALL");
        calls.add(Integer.parseInt(idCarte));
        calls.add(ConnexionController.idUser);
        ArrayList<Object> datas2 = null;
        try {
            datas2 = ConnexionController.client.send(calls);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
            return;
        }
        ArrayList<Integer> idCartesChien = (ArrayList) datas2.get(0);
        ArrayList<String> lienCartesChien = (ArrayList) datas2.get(1);
        for(int j = 0; j < idCartesChien.size() ; j++) {
            InputStream is = getClass().getResourceAsStream("/sample/img/" + lienCartesChien.get(j));
            Image img = new Image(is != null ? is : getClass().getResourceAsStream("/sample/img/carte.png"),60,100,false,false);
            ImageView chienView = new ImageView(img);
            chienView.setId(idCartesChien.get(j).toString());
            boxChien.getChildren().add(chienView);

            ImageView handView = new ImageView(img);
            handView.setId(idCartesChien.get(j).toString());
            main.getChildren().add(handView);
        }
        for(int i = 0; i< main.getChildren().size() ; i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setOnMouseClicked((e) -> {
                ArrayList<Object> addDogs = new ArrayList<>();
                addDogs.add("ADDDOG");
                addDogs.add(imageCarte.getId());
                ArrayList<Object> datas3 = null;
                try {
                    datas3 = ConnexionController.client.send(addDogs);
                } catch (IOException | ClassNotFoundException ex) {
                    ex.printStackTrace();
                }
                boolean dogDone = (boolean) datas3.get(0);
                String ok = (String) datas3.get(1);

                if(ok.equals("OK")) {
                    main.getChildren().remove(imageCarte);
                    ImageView dogCard = new ImageView(imageCarte.getImage());
                    dogCard.setFitWidth(60);
                    dogCard.setFitHeight(100);
                    boxChien.getChildren().add(dogCard);
                    if(dogDone == true) {
                        launch.setVisible(true);
                        for(int j = 0; j< main.getChildren().size() ; j++) {
                            ImageView imageCarte1 = (ImageView) main.getChildren().get(j);
                            imageCarte1.setDisable(true);
                        }
                    }
                }
                else {
                    statusLabel.setText("Mauvaise carte dans le chien !");
                }

            });
        }
    }

    public void launch() {
        launch.setVisible(false);
        boxChien.setVisible(false);
        ArrayList<Object> waitdog = new ArrayList<>();
        waitdog.add("WAITDOG");
        waitdog.add(ConnexionController.idUser);
        try {
            ArrayList<Object> resp = ConnexionController.client.send(waitdog);
            if ((boolean) resp.get(0)) {
                playTour.setVisible(true);
            }
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
    }

    public void playTour() {
        playTour.setVisible(false);
        ArrayList<Object> begins = new ArrayList<>();
        begins.add("BEGIN");
        try {
            ConnexionController.client.send(begins);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }

        ArrayList<Object> waitTours = new ArrayList<>();
        waitTours.add("WAITTOUR");
        try {
            ArrayList<Object> resp = ConnexionController.client.send(waitTours);
            handleTourUpdate(resp);
        } catch (IOException | ClassNotFoundException e) {
            e.printStackTrace();
        }
        for(int i = 0; i< main.getChildren().size() ; i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setDisable(false);
            int finalI = i;
            imageCarte.setOnMouseClicked((e) -> {
                ArrayList<Object> playTours = new ArrayList<>();
                playTours.add("PLAYTOUR");
                playTours.add(imageCarte.getId());
                playTours.add(ConnexionController.idUser);
                playTours.add(finalI +1);
                ArrayList<Object> datas = null;
                try {
                    datas = ConnexionController.client.send(playTours);
                } catch (IOException | ClassNotFoundException ex) {
                    ex.printStackTrace();
                    return;
                }
                boolean hasError = (boolean) datas.get(0);
                if(hasError == false) {
                    main.getChildren().remove(imageCarte);
                    ImageView img = new ImageView(imageCarte.getImage());
                    img.setFitWidth(60);
                    img.setFitHeight(100);
                    boxTour.getChildren().add(img);
                    endTour.setVisible(true);
                }
                else {
                    statusLabel.setText("Carte non valide !");
                }
            });
        }


    }

    public void endTour() {
        playTour();
        endTour.setVisible(false);
    }


}
